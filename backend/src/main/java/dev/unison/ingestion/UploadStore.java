package dev.unison.ingestion;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import dev.unison.catalog.CatalogPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
class UploadStore {
    private final JdbcClient jdbc;
    private final CatalogPublisher catalog;
    UploadStore(JdbcClient jdbc, CatalogPublisher catalog) { this.jdbc = jdbc; this.catalog = catalog; }

    static UploadJob row(ResultSet rs, int index) throws SQLException {
        return new UploadJob(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("artist"),
                rs.getString("genre"), rs.getString("rights_note"), rs.getString("file_name"), rs.getLong("file_size"),
                rs.getString("status"), rs.getString("error"), rs.getTimestamp("created_at").toInstant(), rs.getInt("attempts"), rs.getString("public_credits"));
    }

    UploadJob create(UUID owner, UploadInput input, String fileName, long size) {
        admit(owner);
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO uploads(id,account_id,title,artist,genre,rights_note,file_name,file_size,status,public_credits)
                VALUES (:id,:owner,:title,:artist,:genre,:rights,:name,:size,'RECEIVING',:credits)
                """).param("id", id).param("owner", owner).param("title", input.title()).param("artist", input.artist())
                .param("genre", input.genre()).param("rights", input.rightsNote()).param("name", fileName).param("size", size).param("credits", input.publicCredits()).update();
        return owned(owner, id, false);
    }

    private void admit(UUID owner) {
        // Serialize submission admission for this account; workers do not hold this lock.
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtext(:owner))").param("owner", owner.toString())
                .query((rs, index) -> true).single();
        int pending = jdbc.sql("SELECT count(*) FROM uploads WHERE account_id=:owner AND status IN ('RECEIVING','QUEUED','PROCESSING')")
                .param("owner", owner).query(Integer.class).single();
        if (pending >= 5) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Wait for your pending uploads to finish (maximum 5).");
    }

    List<UploadJob> list(UUID owner) {
        return jdbc.sql("SELECT * FROM uploads WHERE account_id=:owner ORDER BY created_at DESC LIMIT 100")
                .param("owner", owner).query(UploadStore::row).list();
    }

    UploadJob owned(UUID owner, UUID id, boolean lock) {
        return jdbc.sql("SELECT * FROM uploads WHERE id=:id AND account_id=:owner" + (lock ? " FOR UPDATE" : ""))
                .param("id", id).param("owner", owner).query(UploadStore::row).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Upload not found."));
    }

    void queued(UUID id) { jdbc.sql("UPDATE uploads SET status='QUEUED',updated_at=now() WHERE id=:id AND status='RECEIVING'").param("id", id).update(); }
    void abandon(UUID id) { jdbc.sql("UPDATE uploads SET status='DELETING',updated_at=now() WHERE id=:id AND status='RECEIVING'").param("id", id).update(); }

    void retry(UUID owner, UUID id) {
        admit(owner);
        UploadJob job = owned(owner, id, true);
        if (!job.status().equals("FAILED")) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only failed uploads can be retried.");
        jdbc.sql("UPDATE uploads SET status='QUEUED',error=NULL,attempts=0,output_deleted=false,updated_at=now() WHERE id=:id")
                .param("id", id).update();
    }

    void remove(UUID owner, UUID id) {
        UploadJob job = owned(owner, id, true);
        if (job.status().equals("PROCESSING") || job.status().equals("RECEIVING"))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Wait until this upload finishes processing before removing it.");
        jdbc.sql("UPDATE uploads SET status='DELETING',updated_at=now() WHERE id=:id").param("id", id).update();
        catalog.remove(id.toString());
    }

    void recover() {
        jdbc.sql("UPDATE uploads SET status='DELETING',updated_at=now() WHERE status='RECEIVING' AND updated_at < now()-interval '10 minutes'").update();
        jdbc.sql("""
                UPDATE uploads SET status=CASE WHEN attempts<3 THEN 'QUEUED' ELSE 'FAILED' END,
                error=CASE WHEN attempts<3 THEN NULL ELSE 'Processing was interrupted. Please retry.' END,updated_at=now()
                WHERE status='PROCESSING' AND updated_at<now()-interval '10 minutes'
                """).update();
    }

    Optional<UploadJob> claim() {
        return jdbc.sql("""
                UPDATE uploads SET status='PROCESSING',attempts=attempts+1,updated_at=now()
                WHERE id=(SELECT id FROM uploads WHERE status='QUEUED' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
                RETURNING *
                """).query(UploadStore::row).optional();
    }

    void complete(UploadJob job, int duration) {
        int changed = jdbc.sql("UPDATE uploads SET status='READY',error=NULL,updated_at=now() WHERE id=:id AND status='PROCESSING' AND attempts=:attempts")
                .param("id", job.id()).param("attempts", job.attempts()).update();
        if (changed != 1) throw new IllegalStateException("Upload claim expired");
        String credits = jdbc.sql("SELECT public_credits FROM uploads WHERE id=:id").param("id", job.id()).query(String.class).single();
        catalog.publish(job.id().toString(), job.title(), job.artist(), job.genre(), duration, AudioStorage.outputKey(job.id()), credits);
    }

    void credits(UUID owner, UUID id, String value) {
        UploadJob job = owned(owner, id, true);
        if (job.status().equals("DELETING")) throw new ResponseStatusException(HttpStatus.CONFLICT, "Upload is being removed.");
        jdbc.sql("UPDATE uploads SET public_credits=:credits WHERE id=:id").param("credits", value).param("id", id).update();
        catalog.credits(id.toString(), value);
    }

    void failed(UploadJob job, String error) {
        jdbc.sql("UPDATE uploads SET status='FAILED',error=:error,updated_at=now() WHERE id=:id AND status='PROCESSING' AND attempts=:attempts")
                .param("error", error).param("id", job.id()).param("attempts", job.attempts()).update();
    }

    // Cleanup holds a row lock so a retry cannot race with removal of a failed output.
    void cleanup(AudioStorage storage) throws Exception {
        var job = jdbc.sql("""
                SELECT * FROM uploads WHERE status='DELETING' OR (status='READY' AND NOT source_deleted)
                OR (status='FAILED' AND NOT output_deleted) ORDER BY updated_at LIMIT 1 FOR UPDATE SKIP LOCKED
                """).query(UploadStore::row).optional();
        if (job.isEmpty()) return;
        UploadJob value = job.get();
        if (!value.status().equals("FAILED")) storage.removeSource(value.id());
        if (!value.status().equals("READY")) storage.removeOutput(value.id());
        if (value.status().equals("DELETING")) jdbc.sql("DELETE FROM uploads WHERE id=:id").param("id", value.id()).update();
        else if (value.status().equals("READY")) jdbc.sql("UPDATE uploads SET source_deleted=true WHERE id=:id").param("id", value.id()).update();
        else jdbc.sql("UPDATE uploads SET output_deleted=true WHERE id=:id").param("id", value.id()).update();
    }
}

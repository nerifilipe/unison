package dev.unison.library;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import dev.unison.catalog.CatalogReader;
import dev.unison.catalog.TrackDto;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
class LibraryService {
    private final JdbcClient jdbc;
    private final CatalogReader catalog;
    LibraryService(JdbcClient jdbc, CatalogReader catalog) { this.jdbc = jdbc; this.catalog = catalog; }

    List<TrackDto> favorites(UUID owner) {
        return catalog.ordered(jdbc.sql("SELECT track_id FROM favorites WHERE account_id=:owner ORDER BY created_at DESC,track_id")
                .param("owner", owner).query(String.class).list());
    }

    void favorite(UUID owner, String trackId, boolean add) {
        catalog.require(trackId);
        jdbc.sql(add ? "INSERT INTO favorites(account_id,track_id) VALUES (:owner,:track) ON CONFLICT DO NOTHING"
                     : "DELETE FROM favorites WHERE account_id=:owner AND track_id=:track")
                .param("owner", owner).param("track", trackId).update();
    }

    List<PlaylistSummary> playlists(UUID owner) {
        return jdbc.sql("""
                SELECT p.id,p.name,p.description,count(pt.track_id) AS track_count
                FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id
                WHERE p.account_id=:owner GROUP BY p.id ORDER BY p.created_at DESC,p.id
                """).param("owner", owner).query((rs, row) -> new PlaylistSummary(rs.getObject("id", UUID.class),
                        rs.getString("name"), rs.getString("description"), rs.getInt("track_count"))).list();
    }

    PlaylistDetail create(UUID owner, PlaylistInput input) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO playlists(id,account_id,name,description) VALUES (:id,:owner,:name,:description)")
                .param("id", id).param("owner", owner).param("name", input.name()).param("description", input.description()).update();
        return detail(owner, id);
    }

    PlaylistDetail detail(UUID owner, UUID id) {
        PlaylistSummary metadata = owned(owner, id, false);
        return new PlaylistDetail(id, metadata.name(), metadata.description(), catalog.ordered(trackIds(id)));
    }

    void update(UUID owner, UUID id, PlaylistInput input) {
        owned(owner, id, true);
        jdbc.sql("UPDATE playlists SET name=:name,description=:description WHERE id=:id AND account_id=:owner")
                .param("id", id).param("owner", owner).param("name", input.name()).param("description", input.description()).update();
    }

    void delete(UUID owner, UUID id) {
        owned(owner, id, true);
        jdbc.sql("DELETE FROM playlists WHERE id=:id AND account_id=:owner").param("id", id).param("owner", owner).update();
    }

    void add(UUID owner, UUID id, String track) {
        owned(owner, id, true);
        catalog.require(track);
        jdbc.sql("""
                INSERT INTO playlist_tracks(playlist_id,track_id,position)
                SELECT :id,:track,coalesce(max(position),-1)+1 FROM playlist_tracks WHERE playlist_id=:id
                ON CONFLICT DO NOTHING
                """).param("id", id).param("track", track).update();
    }

    void remove(UUID owner, UUID id, String track) {
        owned(owner, id, true);
        jdbc.sql("DELETE FROM playlist_tracks WHERE playlist_id=:id AND track_id=:track")
                .param("id", id).param("track", track).update();
    }

    void reorder(UUID owner, UUID id, List<String> order) {
        owned(owner, id, true);
        List<String> current = trackIds(id);
        if (order.size() != current.size() || new HashSet<>(order).size() != order.size()
                || !new HashSet<>(order).equals(new HashSet<>(current))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Playlist changed. Refresh it and try again.");
        }
        for (int index = 0; index < order.size(); index++) {
            jdbc.sql("UPDATE playlist_tracks SET position=:position WHERE playlist_id=:id AND track_id=:track")
                    .param("position", index).param("id", id).param("track", order.get(index)).update();
        }
    }

    private List<String> trackIds(UUID id) {
        return jdbc.sql("SELECT track_id FROM playlist_tracks WHERE playlist_id=:id ORDER BY position,track_id")
                .param("id", id).query(String.class).list();
    }

    private PlaylistSummary owned(UUID owner, UUID id, boolean lock) {
        return jdbc.sql("SELECT id,name,description FROM playlists WHERE id=:id AND account_id=:owner" + (lock ? " FOR UPDATE" : ""))
                .param("id", id).param("owner", owner)
                .query((rs, row) -> new PlaylistSummary(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"), 0))
                .optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Playlist not found."));
    }

    record PlaylistSummary(UUID id, String name, String description, int trackCount) {}
    record PlaylistDetail(UUID id, String name, String description, List<TrackDto> tracks) {}
}

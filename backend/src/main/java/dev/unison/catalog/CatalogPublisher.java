package dev.unison.catalog;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Catalog write boundary. Called inside the ingestion transaction after successful encoding. */
@Service
public class CatalogPublisher {
    private final JdbcClient jdbc;
    public CatalogPublisher(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void publish(String id, String title, String artist, String genre, int seconds, String key, String credits) {
        jdbc.sql("""
                INSERT INTO tracks(id,title,artist,genre,duration_seconds,audio_key,artwork,position,public_credits)
                VALUES (:id,:title,:artist,:genre,:seconds,:key,'orbit',nextval('catalog_position'),:credits)
                ON CONFLICT (id) DO NOTHING
                """).param("id", id).param("title", title).param("artist", artist).param("genre", genre)
                .param("seconds", seconds).param("key", key).param("credits", credits).update();
    }
    public void credits(String id, String value) { jdbc.sql("UPDATE tracks SET public_credits=:credits WHERE id=:id").param("credits", value).param("id", id).update(); }
    public void remove(String id) { jdbc.sql("DELETE FROM tracks WHERE id=:id").param("id", id).update(); }
}

package dev.unison.catalog;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Catalog write boundary. Called inside the ingestion transaction after successful encoding. */
@Service
public class CatalogPublisher {
    private final JdbcClient jdbc;
    public CatalogPublisher(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void publish(String id, String title, String artist, String genre, int seconds, String key) {
        jdbc.sql("""
                INSERT INTO tracks(id,title,artist,genre,duration_seconds,audio_key,artwork,position)
                VALUES (:id,:title,:artist,:genre,:seconds,:key,'orbit',nextval('catalog_position'))
                ON CONFLICT (id) DO NOTHING
                """).param("id", id).param("title", title).param("artist", artist).param("genre", genre)
                .param("seconds", seconds).param("key", key).update();
    }
    public void remove(String id) { jdbc.sql("DELETE FROM tracks WHERE id=:id").param("id", id).update(); }
}

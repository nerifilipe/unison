package dev.unison.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "tracks")
class Track {
    @Id private String id;
    private String title;
    private String artist;
    private String genre;
    private int durationSeconds;
    private String audioKey;
    private String artwork;
    private int position;
    private String publicCredits;

    protected Track() {}

    TrackDto toDto() {
        return new TrackDto(id, title, artist, genre, durationSeconds,
                "/media/demo/" + audioKey, artwork, publicCredits);
    }
}

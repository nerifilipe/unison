package dev.unison.catalog;

public record TrackDto(String id, String title, String artist, String genre,
                       int durationSeconds, String audioUrl, String artwork, String publicCredits) {
    public TrackDto(String id, String title, String artist, String genre, int durationSeconds, String audioUrl, String artwork) {
        this(id, title, artist, genre, durationSeconds, audioUrl, artwork, "");
    }
}

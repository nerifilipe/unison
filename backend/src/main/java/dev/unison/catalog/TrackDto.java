package dev.unison.catalog;

public record TrackDto(String id, String title, String artist, String genre,
                       int durationSeconds, String audioUrl, String artwork) {}

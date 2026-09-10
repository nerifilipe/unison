package dev.unison.ingestion;

import java.time.Instant;
import java.util.UUID;

public record UploadJob(UUID id, String title, String artist, String genre, String rightsNote,
        String fileName, long fileSize, String status, String error, Instant createdAt, int attempts) {}

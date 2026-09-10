package dev.unison.ingestion;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UploadInput(@NotBlank @Size(max=120) String title,
        @NotBlank @Size(max=120) String artist, @NotBlank @Size(max=64) String genre,
        @AssertTrue(message="You must have permission to distribute this audio.") boolean rightsConfirmed,
        @NotBlank @Size(max=500) String rightsNote, @Size(max=1000) String publicCredits) {
    public UploadInput {
        title = title == null ? "" : title.strip();
        artist = artist == null ? "" : artist.strip();
        genre = genre == null ? "" : genre.strip();
        rightsNote = rightsNote == null ? "" : rightsNote.strip();
        publicCredits = publicCredits == null ? "" : publicCredits.strip();
    }
}

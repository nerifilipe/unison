package dev.unison.library;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record PlaylistInput(@NotBlank @Size(max = 80) String name, @Size(max = 500) String description) {
    PlaylistInput {
        name = name == null ? "" : name.strip();
        description = description == null ? "" : description.strip();
    }
}

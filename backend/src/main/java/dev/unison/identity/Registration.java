package dev.unison.identity;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

record Registration(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 1, max = 60) String displayName,
        @NotBlank @Size(min = 10, max = 64) String password) {
    Registration {
        email = AccountService.normalize(email);
        displayName = displayName == null ? "" : displayName.strip();
    }
}

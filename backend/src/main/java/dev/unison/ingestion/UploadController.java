package dev.unison.ingestion;

import java.security.Principal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/uploads")
class UploadController {
    private final UploadStore jobs;
    private final AudioStorage storage;
    UploadController(UploadStore jobs, AudioStorage storage) { this.jobs = jobs; this.storage = storage; }
    private UUID owner(Principal principal) { return UUID.fromString(principal.getName()); }

    @GetMapping List<UploadJob> list(Principal principal) { return jobs.list(owner(principal)); }
    @GetMapping("/{id}") UploadJob get(Principal principal, @PathVariable UUID id) { return jobs.owned(owner(principal), id, false); }

    @PostMapping(consumes="multipart/form-data") @ResponseStatus(HttpStatus.ACCEPTED)
    UploadJob upload(Principal principal, @Valid @RequestPart("metadata") UploadInput input, @RequestPart("audio") MultipartFile audio) {
        String name = audio.getOriginalFilename() == null ? "" : audio.getOriginalFilename().replace('\\','/');
        name = name.substring(name.lastIndexOf('/')+1);
        validateFile(name, audio.getSize());
        UUID account = owner(principal);
        UploadJob job = jobs.create(account, input, name, audio.getSize());
        try (var stream = audio.getInputStream()) {
            storage.putSource(job.id(), stream, audio.getSize());
            jobs.queued(job.id());
            return jobs.owned(account, job.id(), false);
        } catch (Exception error) {
            jobs.abandon(job.id());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "The audio could not be stored. Please try again.");
        }
    }

    static void validateFile(String name, long size) {
        if (size < 1 || size > 25L*1024*1024) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a non-empty audio file up to 25 MiB.");
        if (name.length() > 255 || !name.toLowerCase(Locale.ROOT).matches(".+\\.(wav|mp3|flac|ogg)"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a WAV, MP3, FLAC or OGG file.");
    }

    @PostMapping("/{id}/retry") @ResponseStatus(HttpStatus.NO_CONTENT)
    void retry(Principal principal, @PathVariable UUID id) { jobs.retry(owner(principal), id); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(Principal principal, @PathVariable UUID id) { jobs.remove(owner(principal), id); }
}

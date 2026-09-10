package dev.unison.ingestion;

import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name="unison.uploads.enabled", havingValue="true", matchIfMissing=true)
class UploadWorker {
    private static final Logger log = LoggerFactory.getLogger(UploadWorker.class);
    private final UploadStore jobs;
    private final AudioStorage storage;
    private final AudioProcessor processor;
    UploadWorker(UploadStore jobs, AudioStorage storage, AudioProcessor processor) { this.jobs = jobs; this.storage = storage; this.processor = processor; }

    @Scheduled(fixedDelay=1500, initialDelay=3000)
    void tick() {
        jobs.recover();
        try { jobs.cleanup(storage); } catch (Exception error) { log.warn("Audio cleanup will be retried ({})", error.getClass().getSimpleName()); }
        jobs.claim().ifPresent(this::process);
    }

    private void process(UploadJob job) {
        Path directory = null;
        try {
            directory = Files.createTempDirectory("unison-audio-");
            Path source = directory.resolve("source");
            Path output = directory.resolve("audio.mp3");
            storage.getSource(job.id(), source);
            int duration = processor.process(source, output);
            storage.putOutput(job.id(), output);
            jobs.complete(job, duration);
        } catch (Exception error) {
            jobs.failed(job, error instanceof AudioProcessor.InvalidAudio ? error.getMessage() : "Processing or storage is unavailable. Please retry later.");
            log.warn("Upload {} failed ({})", job.id(), error.getClass().getSimpleName());
        } finally {
            if (directory != null) {
                try {
                    Files.deleteIfExists(directory.resolve("source"));
                    Files.deleteIfExists(directory.resolve("audio.mp3"));
                    Files.deleteIfExists(directory);
                } catch (Exception error) { log.warn("Temporary audio cleanup failed for {}", job.id()); }
            }
        }
    }
}

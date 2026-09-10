package dev.unison.ingestion;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;

@Service
class AudioProcessor {
    static class InvalidAudio extends RuntimeException { InvalidAudio(String message) { super(message); } }
    private static final String FORMATS = "wav,mp3,flac,ogg";

    int process(Path source, Path output) throws Exception {
        probe(source);
        run(List.of("ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-max_alloc", "67108864",
                "-protocol_whitelist", "file,pipe", "-format_whitelist", FORMATS, "-threads", "1", "-i", source.toString(),
                "-map", "0:a:0", "-vn", "-map_metadata", "-1", "-threads", "1", "-filter_threads", "1",
                "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-t", "600", "-f", "mp3", output.toString()), Duration.ofSeconds(120));
        return Math.max(1, (int) Math.round(probe(output)));
    }

    private double probe(Path file) throws Exception {
        String output = run(List.of("ffprobe", "-v", "error", "-max_alloc", "67108864", "-protocol_whitelist", "file,pipe",
                "-format_whitelist", FORMATS, "-show_entries", "stream=codec_type:format=duration",
                "-of", "default=noprint_wrappers=1", file.toString()), Duration.ofSeconds(20));
        return validateProbe(output);
    }

    static double validateProbe(String text) {
        List<String> streams = text.lines().filter(line -> line.startsWith("codec_type=")).toList();
        if (streams.size() != 1 || !streams.getFirst().equals("codec_type=audio"))
            throw new InvalidAudio("Choose a file containing one audio stream and no video or cover-art stream.");
        try {
            double duration = Double.parseDouble(text.lines().filter(line -> line.startsWith("duration=")).findFirst().orElseThrow().substring(9));
            if (!Double.isFinite(duration) || duration < 1 || duration > 600.1) throw new IllegalArgumentException();
            return duration;
        } catch (Exception error) { throw new InvalidAudio("Audio duration must be between 1 second and 10 minutes."); }
    }

    private String run(List<String> command, Duration timeout) throws Exception {
        // Argument arrays, not a shell; no filename or metadata is interpolated into commands.
        Process process = new ProcessBuilder(new ArrayList<>(command)).redirectErrorStream(true).start();
        var output = new java.io.ByteArrayOutputStream();
        Thread reader = Thread.ofVirtual().start(() -> {
            try (var input = process.getInputStream()) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (output.size() < 16384) output.write(buffer, 0, Math.min(count, 16384-output.size()));
                }
            } catch (IOException ignored) { /* Termination closes the stream. */ }
        });
        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS))
                throw new InvalidAudio("Audio processing timed out. Try a shorter or simpler file.");
            reader.join(2000);
            if (process.exitValue() != 0) throw new InvalidAudio("This file could not be decoded. Use a valid WAV, MP3, FLAC or OGG audio file.");
            return output.toString(java.nio.charset.StandardCharsets.UTF_8);
        } finally {
            if (process.isAlive()) { process.destroyForcibly(); process.waitFor(5, TimeUnit.SECONDS); }
            reader.join(2000);
        }
    }
}

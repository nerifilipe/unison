package dev.unison.ingestion;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import io.minio.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
class AudioStorage {
    private final MinioClient client;
    AudioStorage(@Value("${unison.storage.endpoint}") String endpoint,
            @Value("${unison.storage.access-key}") String access, @Value("${unison.storage.secret-key}") String secret) {
        client = MinioClient.builder().endpoint(endpoint).credentials(access, secret).build();
        client.setTimeout(5000, 30000, 30000);
    }
    static String outputKey(UUID id) { return "uploads/" + id + ".mp3"; }
    void putSource(UUID id, InputStream input, long size) throws Exception {
        client.putObject(PutObjectArgs.builder().bucket("originals").object(id.toString())
                .stream(input, size, -1).contentType("application/octet-stream").build());
    }
    void getSource(UUID id, Path target) throws Exception {
        try (var input = client.getObject(GetObjectArgs.builder().bucket("originals").object(id.toString()).build())) {
            Files.copy(input, target);
        }
    }
    void putOutput(UUID id, Path source) throws Exception {
        client.uploadObject(UploadObjectArgs.builder().bucket("demo").object(outputKey(id))
                .filename(source.toString()).contentType("audio/mpeg").build());
    }
    void removeSource(UUID id) throws Exception { client.removeObject(RemoveObjectArgs.builder().bucket("originals").object(id.toString()).build()); }
    void removeOutput(UUID id) throws Exception { client.removeObject(RemoveObjectArgs.builder().bucket("demo").object(outputKey(id)).build()); }
}

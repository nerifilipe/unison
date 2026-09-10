package dev.unison.shared;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<?> tooLarge() {
        return ResponseEntity.status(413).body(Map.of("message", "Audio files must be at most 25 MiB."));
    }
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode())
                .body(Map.of("message", error.getReason() == null ? "Request failed." : error.getReason()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().getFirst();
        return ResponseEntity.badRequest().body(Map.of("message", field.getField() + ": " + field.getDefaultMessage()));
    }
}

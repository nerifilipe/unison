package dev.unison.catalog;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Read-only catalog boundary used by the library module. */
@Service
public class CatalogReader {
    private final TrackRepository tracks;
    public CatalogReader(TrackRepository tracks) { this.tracks = tracks; }

    public void require(String id) {
        if (!tracks.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found.");
    }

    public List<TrackDto> ordered(List<String> ids) {
        Map<String, TrackDto> found = tracks.findAllById(ids).stream().map(Track::toDto)
                .collect(Collectors.toMap(TrackDto::id, Function.identity()));
        return ids.stream().filter(found::containsKey).map(found::get).toList();
    }
}

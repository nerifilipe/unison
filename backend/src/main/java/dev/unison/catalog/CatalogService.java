package dev.unison.catalog;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
class CatalogService {
    private final TrackRepository tracks;

    CatalogService(TrackRepository tracks) { this.tracks = tracks; }

    @Transactional(readOnly = true)
    public List<TrackDto> list(String query) {
        String term = query.strip();
        if (term.length() > 120) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search must be at most 120 characters.");
        return tracks.findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCaseOrGenreContainingIgnoreCaseOrderByPositionAsc(
                term, term, term, PageRequest.of(0, 100)).stream().map(Track::toDto).toList();
    }
}

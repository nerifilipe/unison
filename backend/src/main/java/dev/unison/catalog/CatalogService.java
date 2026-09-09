package dev.unison.catalog;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class CatalogService {
    private final TrackRepository tracks;

    CatalogService(TrackRepository tracks) { this.tracks = tracks; }

    @Transactional(readOnly = true)
    public List<TrackDto> list() {
        return tracks.findAllByOrderByPositionAsc().stream().map(Track::toDto).toList();
    }
}

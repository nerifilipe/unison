package dev.unison.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

interface TrackRepository extends JpaRepository<Track, String> {
    List<Track> findAllByOrderByPositionAsc();
    List<Track> findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCaseOrGenreContainingIgnoreCaseOrderByPositionAsc(
            String title, String artist, String genre, Pageable page);
}

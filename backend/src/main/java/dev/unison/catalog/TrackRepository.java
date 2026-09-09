package dev.unison.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface TrackRepository extends JpaRepository<Track, String> {
    List<Track> findAllByOrderByPositionAsc();
}

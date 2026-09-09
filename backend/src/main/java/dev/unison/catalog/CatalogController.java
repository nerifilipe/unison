package dev.unison.catalog;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tracks")
class CatalogController {
    private final CatalogService catalog;

    CatalogController(CatalogService catalog) { this.catalog = catalog; }

    @GetMapping
    List<TrackDto> list() { return catalog.list(); }
}

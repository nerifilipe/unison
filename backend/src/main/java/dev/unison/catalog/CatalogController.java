package dev.unison.catalog;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/tracks")
class CatalogController {
    private final CatalogService catalog;

    CatalogController(CatalogService catalog) { this.catalog = catalog; }

    @GetMapping
    List<TrackDto> list(@RequestParam(defaultValue = "") String q) { return catalog.list(q); }
}

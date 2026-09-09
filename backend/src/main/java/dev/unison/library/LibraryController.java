package dev.unison.library;

import java.security.Principal;
import java.util.List;
import java.util.UUID;
import dev.unison.catalog.TrackDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/library")
class LibraryController {
    private final LibraryService library;
    LibraryController(LibraryService library) { this.library = library; }
    private UUID owner(Principal principal) { return UUID.fromString(principal.getName()); }

    @GetMapping("/favorites") List<TrackDto> favorites(Principal principal) { return library.favorites(owner(principal)); }
    @PutMapping("/favorites/{track}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void favorite(Principal principal, @PathVariable String track) { library.favorite(owner(principal), track, true); }
    @DeleteMapping("/favorites/{track}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void unfavorite(Principal principal, @PathVariable String track) { library.favorite(owner(principal), track, false); }

    @GetMapping("/playlists") List<LibraryService.PlaylistSummary> playlists(Principal principal) { return library.playlists(owner(principal)); }
    @PostMapping("/playlists") @ResponseStatus(HttpStatus.CREATED)
    LibraryService.PlaylistDetail create(Principal principal, @Valid @RequestBody PlaylistInput input) { return library.create(owner(principal), input); }
    @GetMapping("/playlists/{id}")
    LibraryService.PlaylistDetail detail(Principal principal, @PathVariable UUID id) { return library.detail(owner(principal), id); }
    @PutMapping("/playlists/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void update(Principal principal, @PathVariable UUID id, @Valid @RequestBody PlaylistInput input) { library.update(owner(principal), id, input); }
    @DeleteMapping("/playlists/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(Principal principal, @PathVariable UUID id) { library.delete(owner(principal), id); }
    @PutMapping("/playlists/{id}/tracks/{track}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void add(Principal principal, @PathVariable UUID id, @PathVariable String track) { library.add(owner(principal), id, track); }
    @DeleteMapping("/playlists/{id}/tracks/{track}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(Principal principal, @PathVariable UUID id, @PathVariable String track) { library.remove(owner(principal), id, track); }
    @PutMapping("/playlists/{id}/order") @ResponseStatus(HttpStatus.NO_CONTENT)
    void reorder(Principal principal, @PathVariable UUID id, @Valid @RequestBody TrackOrder order) { library.reorder(owner(principal), id, order.trackIds()); }

    record TrackOrder(@NotNull @Size(max = 10000) List<@NotNull String> trackIds) {}
}

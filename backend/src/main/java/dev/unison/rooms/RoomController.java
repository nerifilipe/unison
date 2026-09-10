package dev.unison.rooms;

import java.security.Principal;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
class RoomController {
    private final RoomService rooms;
    RoomController(RoomService rooms) { this.rooms=rooms; }
    record Create(@NotBlank @Size(max=80) String name) { Create { name=name==null?"":name.strip(); } }
    record Add(@NotBlank @Size(max=100) String trackId) {}
    record Vote(boolean enabled) {}
    record Control(@NotBlank String action, double position, @Min(0) long revision) {}
    private UUID user(Principal principal) { return UUID.fromString(principal.getName()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) RoomService.Snapshot create(Principal p,@Valid @RequestBody Create input) { return rooms.create(user(p),input.name()); }
    @PostMapping("/{id}/join") RoomService.Snapshot join(Principal p,@PathVariable UUID id) { return rooms.join(id,user(p)); }
    @GetMapping("/{id}") RoomService.Snapshot get(Principal p,@PathVariable UUID id) { return rooms.read(id,user(p)); }
    @DeleteMapping("/{id}/membership") @ResponseStatus(HttpStatus.NO_CONTENT) void leave(Principal p,@PathVariable UUID id) { rooms.leave(id,user(p)); }
    @PostMapping("/{id}/queue") RoomService.Snapshot add(Principal p,@PathVariable UUID id,@Valid @RequestBody Add input) { return rooms.add(id,user(p),input.trackId()); }
    @PutMapping("/{id}/queue/{entry}/vote") RoomService.Snapshot vote(Principal p,@PathVariable UUID id,@PathVariable UUID entry,@RequestBody Vote input) { return rooms.vote(id,user(p),entry,input.enabled()); }
    @DeleteMapping("/{id}/queue/{entry}") RoomService.Snapshot remove(Principal p,@PathVariable UUID id,@PathVariable UUID entry) { return rooms.remove(id,user(p),entry); }
    @PostMapping("/{id}/control") RoomService.Snapshot control(Principal p,@PathVariable UUID id,@Valid @RequestBody Control input) { return rooms.control(id,user(p),input.action(),input.position(),input.revision()); }
}

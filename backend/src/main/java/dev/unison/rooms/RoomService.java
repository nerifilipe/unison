package dev.unison.rooms;

import dev.unison.catalog.CatalogReader;
import dev.unison.catalog.TrackDto;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Ephemeral single-instance rooms. All state transitions serialize on the room monitor. */
@Service
public class RoomService {
    private final Map<UUID, Room> rooms = new ConcurrentHashMap<>();
    private final CatalogReader catalog;
    private final JdbcClient jdbc;
    private final Clock clock;
    @org.springframework.beans.factory.annotation.Autowired
    public RoomService(CatalogReader catalog, JdbcClient jdbc) { this(catalog, jdbc, Clock.systemUTC()); }
    RoomService(CatalogReader catalog, JdbcClient jdbc, Clock clock) { this.catalog=catalog; this.jdbc=jdbc; this.clock=clock; }
    static class Member {
        final UUID id; final String name; long seen;
        Member(UUID id, String name, long now) { this.id=id; this.name=name; this.seen=now; }
    }
    static class Entry {
        final UUID id=UUID.randomUUID(); final String track; final long order;
        final Set<UUID> votes=new HashSet<>();
        Entry(String track, long order) { this.track=track; this.order=order; }
    }
    static class Room {
        final UUID id=UUID.randomUUID(), host; final String name;
        final Map<UUID,Member> members=new LinkedHashMap<>(); final List<Entry> queue=new ArrayList<>();
        String current; boolean playing, closed; double position; long anchor, revision, sequence, activity;
        Room(UUID host, String name, long now) { this.host=host; this.name=name; this.anchor=now; this.activity=now; }
    }
    public record MemberDto(UUID id, String displayName, boolean online) {}
    public record QueueDto(UUID id, TrackDto track, int votes, boolean voted) {}
    public record Snapshot(UUID id, String name, UUID hostId, long revision, long serverTime,
            TrackDto track, boolean playing, double position, List<MemberDto> members, List<QueueDto> queue) {}

    synchronized Snapshot create(UUID user, String name) {
        if (rooms.size()>=100 || rooms.values().stream().filter(room -> room.host.equals(user)).count()>=3)
            throw failure(HttpStatus.TOO_MANY_REQUESTS,"Room limit reached. End an existing room first.");
        Room room=new Room(user,name,clock.millis());
        room.members.put(user,member(user)); rooms.put(room.id,room);
        return snapshot(room,user);
    }
    private Member member(UUID user) {
        String name=jdbc.sql("SELECT display_name FROM accounts WHERE id=:id").param("id",user).query(String.class).single();
        return new Member(user,name,clock.millis());
    }
    Snapshot join(UUID id, UUID user) {
        Room room=room(id);
        synchronized(room) {
            checkOpen(room);
            if (!room.members.containsKey(user)) {
                if(room.members.size()>=50) throw failure(HttpStatus.CONFLICT,"This room is full (50 members).");
                room.members.put(user,member(user)); room.revision++;
            }
            touch(room,user); return snapshot(room,user);
        }
    }
    public Snapshot read(UUID id, UUID user) {
        Room room=room(id);
        synchronized(room) { requireMember(room,user); return snapshot(room,user); }
    }
    public Snapshot heartbeat(UUID id, UUID user) {
        Room room=room(id);
        synchronized(room) { requireMember(room,user); touch(room,user); return snapshot(room,user); }
    }
    Snapshot add(UUID id, UUID user, String track) {
        Room room=room(id);
        synchronized(room) {
            requireMember(room,user); catalog.require(track);
            if(room.queue.size()>=100) throw failure(HttpStatus.CONFLICT,"The queue is full (100 tracks).");
            if(room.queue.stream().anyMatch(entry -> entry.track.equals(track))) throw failure(HttpStatus.CONFLICT,"This track is already queued.");
            room.queue.add(new Entry(track,++room.sequence)); room.revision++; touch(room,user);
            return snapshot(room,user);
        }
    }
    Snapshot vote(UUID id, UUID user, UUID entryId, boolean enabled) {
        Room room=room(id);
        synchronized(room) {
            requireMember(room,user);
            Entry entry=entry(room,entryId);
            boolean changed=enabled ? entry.votes.add(user) : entry.votes.remove(user);
            if(changed) room.revision++; touch(room,user);
            return snapshot(room,user);
        }
    }
    Snapshot remove(UUID id, UUID user, UUID entryId) {
        Room room=room(id);
        synchronized(room) { host(room,user); room.queue.remove(entry(room,entryId)); room.revision++; touch(room,user); return snapshot(room,user); }
    }
    Snapshot control(UUID id, UUID user, String action, double position, long expected) {
        Room room=room(id);
        synchronized(room) {
            host(room,user); reconcile(room);
            if(expected!=room.revision) throw failure(HttpStatus.CONFLICT,"Room changed. Wait for the latest state and try again.");
            long now=clock.millis();
            switch(action) {
                case "play" -> { room.position=position(room,now); if(room.current==null) next(room,now); room.playing=room.current!=null; room.anchor=now; }
                case "pause" -> { room.position=position(room,now); room.playing=false; room.anchor=now; }
                case "seek" -> {
                    if(room.current==null) throw failure(HttpStatus.CONFLICT,"Choose a queued track first.");
                    TrackDto track=catalog.ordered(List.of(room.current)).getFirst();
                    if(!Double.isFinite(position)||position<0||position>track.durationSeconds()) throw failure(HttpStatus.BAD_REQUEST,"Seek position is outside this track.");
                    room.position=position; room.anchor=now;
                }
                case "next" -> next(room,now);
                default -> throw failure(HttpStatus.BAD_REQUEST,"Unknown playback command.");
            }
            room.revision++; touch(room,user); return snapshot(room,user);
        }
    }
    void leave(UUID id, UUID user) {
        Room room=room(id);
        synchronized(room) {
            requireMember(room,user);
            if(room.host.equals(user)) { room.closed=true; rooms.remove(id,room); }
            else { room.members.remove(user); room.queue.forEach(entry -> entry.votes.remove(user)); room.revision++; }
        }
    }
    private void next(Room room,long now) {
        List<Entry> order=ordered(room); room.current=order.isEmpty()?null:order.getFirst().track;
        if(!order.isEmpty()) room.queue.remove(order.getFirst());
        room.position=0; room.anchor=now; room.playing=room.current!=null;
    }
    private List<Entry> ordered(Room room) { return room.queue.stream().sorted(Comparator.<Entry>comparingInt(entry -> entry.votes.size()).reversed().thenComparingLong(entry -> entry.order)).toList(); }
    private double position(Room room,long now) { return room.position+(room.playing?Math.max(0,now-room.anchor)/1000.0:0); }
    private void reconcile(Room room) {
        long now=clock.millis();
        List<String> ids=new ArrayList<>(room.queue.stream().map(entry -> entry.track).toList());
        if(room.current!=null) ids.add(room.current);
        Map<String,TrackDto> tracks=new HashMap<>(); catalog.ordered(ids).forEach(track -> tracks.put(track.id(),track));
        if(room.queue.removeIf(entry -> !tracks.containsKey(entry.track))) room.revision++;
        if(room.playing && now-room.members.get(room.host).seen>30000) { room.position=position(room,now); room.playing=false; room.anchor=now; room.revision++; }
        if(room.current!=null && (!tracks.containsKey(room.current) || (room.playing && position(room,now)>=tracks.get(room.current).durationSeconds()))) {
            next(room,now); room.revision++;
        }
    }
    private Snapshot snapshot(Room room,UUID user) {
        reconcile(room); long now=clock.millis();
        List<String> ids=new ArrayList<>(room.queue.stream().map(entry -> entry.track).toList()); if(room.current!=null)ids.add(room.current);
        Map<String,TrackDto> tracks=new HashMap<>(); catalog.ordered(ids).forEach(track -> tracks.put(track.id(),track));
        return new Snapshot(room.id,room.name,room.host,room.revision,now,tracks.get(room.current),room.playing,position(room,now),
                room.members.values().stream().map(member -> new MemberDto(member.id,member.name,now-member.seen<10000)).toList(),
                ordered(room).stream().filter(entry -> tracks.containsKey(entry.track)).map(entry -> new QueueDto(entry.id,tracks.get(entry.track),entry.votes.size(),entry.votes.contains(user))).toList());
    }
    @Scheduled(fixedDelay=1000) void tick() {
        rooms.values().forEach(room -> { synchronized(room) {
            if(clock.millis()-room.activity>1800000) { room.closed=true; rooms.remove(room.id,room); }
            else reconcile(room);
        }});
    }
    private void touch(Room room,UUID user) { room.members.get(user).seen=clock.millis(); room.activity=clock.millis(); }
    private Room room(UUID id) { Room room=rooms.get(id); if(room==null)throw failure(HttpStatus.NOT_FOUND,"Room ended or invitation is invalid."); return room; }
    private void checkOpen(Room room) { if(room.closed)throw failure(HttpStatus.NOT_FOUND,"This room has ended."); }
    private void requireMember(Room room,UUID user) { checkOpen(room); if(!room.members.containsKey(user))throw failure(HttpStatus.NOT_FOUND,"Join this room first."); }
    private void host(Room room,UUID user) { requireMember(room,user); if(!room.host.equals(user))throw failure(HttpStatus.FORBIDDEN,"Only the host can control playback."); }
    private Entry entry(Room room,UUID id) { return room.queue.stream().filter(entry -> entry.id.equals(id)).findFirst().orElseThrow(() -> failure(HttpStatus.NOT_FOUND,"Queue entry no longer exists.")); }
    private static ResponseStatusException failure(HttpStatus status,String message) { return new ResponseStatusException(status,message); }
}

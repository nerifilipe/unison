package dev.unison.rooms;

import dev.unison.catalog.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RoomServiceTest {
    final UUID host=UUID.randomUUID(), guest=UUID.randomUUID();
    final Map<String,TrackDto> tracks=new ConcurrentHashMap<>();
    final TestClock clock=new TestClock();
    RoomService service;
    @BeforeEach void setup() {
        CatalogReader catalog=mock(CatalogReader.class);
        for(String id:List.of("a","b","c"))tracks.put(id,new TrackDto(id,id,"Artist","Ambient",60,"/media/demo/"+id,"orbit"));
        when(catalog.ordered(anyList())).thenAnswer(call -> ((List<String>)call.getArgument(0)).stream().filter(tracks::containsKey).map(tracks::get).toList());
        JdbcClient jdbc=mock(JdbcClient.class,RETURNS_DEEP_STUBS);
        when(jdbc.sql(anyString()).param(eq("id"),any(UUID.class)).query(String.class).single()).thenReturn("Listener");
        service=new RoomService(catalog,jdbc,clock);
    }
    @Test void votesAreIdempotentTiesStableAndOnlyHostControls() {
        var room=service.create(host,"Test");service.join(room.id(),guest);
        var one=service.add(room.id(),guest,"a");var two=service.add(room.id(),host,"b");
        UUID b=two.queue().get(1).id();
        service.vote(room.id(),guest,b,true);var voted=service.vote(room.id(),guest,b,true);
        assertThat(voted.queue().getFirst().track().id()).isEqualTo("b");
        assertThat(voted.queue().getFirst().votes()).isEqualTo(1);
        assertThatThrownBy(()->service.control(room.id(),guest,"play",0,voted.revision())).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(403));
        var playing=service.control(room.id(),host,"play",0,voted.revision());
        assertThat(playing.track().id()).isEqualTo("b");
        assertThat(playing.queue().getFirst().track().id()).isEqualTo("a");
        assertThatThrownBy(()->service.control(room.id(),host,"pause",0,voted.revision())).isInstanceOfSatisfying(ResponseStatusException.class,e->assertThat(e.getStatusCode().value()).isEqualTo(409));
    }
    @Test void concurrentHostCommandsCannotOverwriteEachOther() throws Exception {
        var room=service.create(host,"Concurrent");var queued=service.add(room.id(),host,"a");
        var start=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> action=()->{start.await();try{service.control(room.id(),host,"play",0,queued.revision());return 200;}catch(ResponseStatusException e){return e.getStatusCode().value();}};
            var a=pool.submit(action);var b=pool.submit(action);start.countDown();
            assertThat(List.of(a.get(),b.get())).containsExactlyInAnyOrder(200,409);
        }
    }
    @Test void serverAdvancesAndPausesWhenHostIsAwayThenExpiresRoom() {
        var room=service.create(host,"Timeline");service.add(room.id(),host,"a");var queued=service.add(room.id(),host,"b");
        service.control(room.id(),host,"play",0,queued.revision());
        clock.now+=59000;service.heartbeat(room.id(),host);clock.now+=2000;service.tick();
        assertThat(service.read(room.id(),host).track().id()).isEqualTo("b");
        clock.now+=31000;service.tick();var paused=service.read(room.id(),host);
        assertThat(paused.playing()).isFalse();double position=paused.position();clock.now+=1000;
        assertThat(service.read(room.id(),host).position()).isEqualTo(position);
        clock.now+=1800001;service.tick();
        assertThatThrownBy(()->service.read(room.id(),host)).isInstanceOf(ResponseStatusException.class);
    }
    @Test void leavingRemovesVotesHostEndsRoomAndDeletedTracksAreSkipped() {
        var room=service.create(host,"Lifecycle");service.join(room.id(),guest);var queued=service.add(room.id(),guest,"a");
        service.vote(room.id(),guest,queued.queue().getFirst().id(),true);service.leave(room.id(),guest);
        assertThat(service.read(room.id(),host).queue().getFirst().votes()).isZero();
        assertThatThrownBy(()->service.read(room.id(),guest)).isInstanceOf(ResponseStatusException.class);
        tracks.remove("a");assertThat(service.read(room.id(),host).queue()).isEmpty();
        service.leave(room.id(),host);assertThatThrownBy(()->service.join(room.id(),guest)).isInstanceOf(ResponseStatusException.class);
    }
    static class TestClock extends Clock {
        long now=1000000;
        public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}public Instant instant(){return Instant.ofEpochMilli(now);}public long millis(){return now;}
    }
}

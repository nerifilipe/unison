package dev.unison.rooms;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.*;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.server.HandshakeInterceptor;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSocket
@EnableScheduling
class RoomSockets extends TextWebSocketHandler implements WebSocketConfigurer, HandshakeInterceptor {
    private final RoomService rooms;
    private final ObjectMapper mapper;
    private final String[] origins;
    private final Map<String,WebSocketSession> connections=new ConcurrentHashMap<>();
    RoomSockets(RoomService rooms,ObjectMapper mapper,@Value("${unison.rooms.allowed-origins:http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173}") String origins) {
        this.rooms=rooms; this.mapper=mapper; this.origins=origins.split(",");
    }
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(this,"/ws/rooms/*").addInterceptors(this).setAllowedOrigins(origins);
    }
    @Override public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Map<String,Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servlet) || request.getPrincipal()==null) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
        try {
            HttpSession session=servlet.getServletRequest().getSession(false);
            UUID user=UUID.fromString(request.getPrincipal().getName());
            UUID room=UUID.fromString(request.getURI().getPath().substring("/ws/rooms/".length()));
            if(session==null) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
            rooms.read(room,user);
            attributes.put("room",room); attributes.put("user",user); attributes.put("httpSession",session);
            return true;
        } catch(ResponseStatusException error) { response.setStatusCode(error.getStatusCode()); return false; }
        catch(Exception error) { response.setStatusCode(HttpStatus.BAD_REQUEST); return false; }
    }
    @Override public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Exception error) {}
    @Override public synchronized void afterConnectionEstablished(WebSocketSession raw) throws Exception {
        UUID user=(UUID)raw.getAttributes().get("user");
        if(connections.size()>=300 || connections.values().stream().filter(s -> user.equals(s.getAttributes().get("user"))).count()>=5) { raw.close(new CloseStatus(1008,"Connection limit reached")); return; }
        raw.setTextMessageSizeLimit(64);
        WebSocketSession session=new ConcurrentWebSocketSessionDecorator(raw,2000,131072);
        connections.put(raw.getId(),session); send(session,null);
    }
    @Override protected void handleTextMessage(WebSocketSession raw,TextMessage message) throws Exception {
        WebSocketSession session=connections.get(raw.getId()); if(session==null)return;
        long now=System.currentTimeMillis();
        Long last=(Long)session.getAttributes().get("lastPing");
        if(last!=null && now-last<200) return;
        session.getAttributes().put("lastPing",now);
        try { send(session,Long.parseLong(message.getPayload())); }
        catch(NumberFormatException error) { session.close(CloseStatus.BAD_DATA); }
    }
    private boolean valid(WebSocketSession session) {
        try {
            HttpSession http=(HttpSession)session.getAttributes().get("httpSession");
            Object value=http.getAttribute("SPRING_SECURITY_CONTEXT");
            return value instanceof SecurityContext context && context.getAuthentication()!=null
                    && context.getAuthentication().isAuthenticated()
                    && context.getAuthentication().getName().equals(session.getAttributes().get("user").toString())
                    && (http.getMaxInactiveInterval()<=0 || System.currentTimeMillis()-http.getLastAccessedTime()<http.getMaxInactiveInterval()*1000L);
        } catch(IllegalStateException error) { return false; }
    }
    record Envelope(RoomService.Snapshot state,Long echo) {}
    private void send(WebSocketSession session,Long echo) {
        try {
            if(!valid(session)) { session.close(new CloseStatus(4001,"Session expired")); return; }
            // Presence must reflect client pings, not our own outgoing broadcasts.
            UUID room=(UUID)session.getAttributes().get("room"), user=(UUID)session.getAttributes().get("user");
            var state=echo==null?rooms.read(room,user):rooms.heartbeat(room,user);
            session.sendMessage(new TextMessage(mapper.writeValueAsString(new Envelope(state,echo))));
        } catch(ResponseStatusException error) {
            try { session.close(new CloseStatus(4004,"Room ended or membership removed")); } catch(Exception ignored) {}
        } catch(Exception error) { try { session.close(CloseStatus.SERVER_ERROR); } catch(Exception ignored) {} }
    }
    @Scheduled(fixedDelay=1000) void broadcast() {
        connections.values().forEach(session -> { if(session.isOpen())send(session,null); else connections.remove(session.getId()); });
    }
    @Override public void afterConnectionClosed(WebSocketSession session,CloseStatus status) { connections.remove(session.getId()); }
    @Override public void handleTransportError(WebSocketSession session,Throwable error) throws Exception { connections.remove(session.getId()); session.close(CloseStatus.SERVER_ERROR); }
}

package dev.unison.identity;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService implements UserDetailsService {
    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;

    public AccountService(JdbcClient jdbc, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.passwords = passwords;
    }

    static String normalize(String email) { return email == null ? "" : email.strip().toLowerCase(Locale.ROOT); }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return jdbc.sql("SELECT id, password_hash FROM accounts WHERE email = :email")
                .param("email", normalize(email))
                .query((rs, row) -> User.withUsername(rs.getString("id"))
                        .password(rs.getString("password_hash")).roles("USER").build())
                .optional().orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
    }

    AccountDto register(Registration registration) {
        if (registration.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at most 72 UTF-8 bytes.");
        }
        UUID id = UUID.randomUUID();
        String hash = passwords.encode(registration.password());
        try {
            jdbc.sql("INSERT INTO accounts(id,email,display_name,password_hash) VALUES (:id,:email,:name,:hash)")
                    .param("id", id).param("email", registration.email())
                    .param("name", registration.displayName()).param("hash", hash).update();
        } catch (DuplicateKeyException duplicate) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }
        return new AccountDto(id, registration.email(), registration.displayName());
    }

    AccountDto find(UUID id) {
        return jdbc.sql("SELECT id,email,display_name FROM accounts WHERE id=:id").param("id", id)
                .query((rs, row) -> new AccountDto(rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("display_name")))
                .optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again."));
    }

    public record AccountDto(UUID id, String email, String displayName) {}
}

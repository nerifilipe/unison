package dev.unison.identity;

import java.security.Principal;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
class AuthController {
    private final AccountService accounts;
    AuthController(AccountService accounts) { this.accounts = accounts; }

    @GetMapping("/csrf")
    CsrfToken csrf(CsrfToken token) { return token; }

    @GetMapping("/me")
    AccountService.AccountDto me(Principal principal) { return accounts.find(UUID.fromString(principal.getName())); }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    AccountService.AccountDto register(@Valid @RequestBody Registration request) { return accounts.register(request); }
}

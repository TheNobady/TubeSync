package com.tubesync.backend.security;

import com.tubesync.backend.entity.User;
import com.tubesync.backend.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Intercepts every HTTP request, extracts the NextAuth JWT from the
 * Authorization header, validates it, and populates the SecurityContext.
 *
 * For WebSocket handshakes, the JWT is passed as a query param `?token=`
 * (SockJS does not support custom headers on the WS upgrade).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final NextAuthJwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String token = resolveToken(request);

        if (token != null && jwtUtil.isValid(token)) {
            try {
                Claims claims = jwtUtil.validateAndExtract(token);
                String googleUid = claims.getSubject();
                String email     = (String) claims.get("email");

                Optional<User> userOpt = userRepository.findByGoogleUid(googleUid);

                if (userOpt.isPresent()) {
                    User user = userOpt.get();
                    var auth = new UsernamePasswordAuthenticationToken(
                            user,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_USER"))
                    );
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } else {
                    log.debug("JWT valid but user not found in DB for googleUid={}", googleUid);
                }

            } catch (Exception e) {
                log.warn("JWT processing failed: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        // 1. Standard Authorization: Bearer <token>
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        // 2. Query param for SockJS WebSocket handshakes
        String param = request.getParameter("token");
        if (param != null && !param.isBlank()) {
            return param;
        }
        return null;
    }
}

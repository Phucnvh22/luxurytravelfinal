package com.luxurytravel.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            final String servletPath = request.getServletPath();

            // 1. Public paths — skip JWT processing entirely, never trigger 401
            if (servletPath == null
                    || servletPath.startsWith("/api/auth/")
                    || servletPath.equals("/api/auth/login")
                    || servletPath.equals("/api/auth/register")
                    || servletPath.startsWith("/swagger-ui/")
                    || servletPath.startsWith("/v3/api-docs/")
                    || servletPath.startsWith("/api-docs")
                    || servletPath.startsWith("/oauth2/")
                    || servletPath.startsWith("/login/oauth2/")
                    || servletPath.startsWith("/h2-console/")
                    || servletPath.startsWith("/api/public/")
                    || servletPath.startsWith("/api/destinations")
                    || servletPath.startsWith("/api/experiences")
                    || servletPath.startsWith("/api/services")
                    || servletPath.startsWith("/api/categories")
                    || servletPath.startsWith("/api/featured-cards")
                    || servletPath.startsWith("/error")) {
                filterChain.doFilter(request, response);
                return;
            }

            // 2. CORS preflight OPTIONS — always pass
            if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                filterChain.doFilter(request, response);
                return;
            }

            final String authHeader = request.getHeader("Authorization");
            final String jwt;
            final String username;

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                // No token → proceed unauthenticated (protected endpoints will 403 later)
                filterChain.doFilter(request, response);
                return;
            }

            jwt = authHeader.substring(7);

            try {
                username = jwtService.extractUsername(jwt);
            } catch (Exception e) {
                // Malformed / expired token → proceed unauthenticated, never 401 here
                filterChain.doFilter(request, response);
                return;
            }

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);
                    if (jwtService.isTokenValid(jwt, userDetails)) {
                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                        authToken.setDetails(
                                new WebAuthenticationDetailsSource().buildDetails(request)
                        );
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    }
                } catch (UsernameNotFoundException e) {
                    // No longer exists — proceed
                } catch (Exception e) {
                    // Any DB / other error — proceed unauthenticated
                }
            }
        } catch (Exception e) {
            // Safety net: NEVER throw from filter (prevents 401 for non-auth reasons)
        }
        filterChain.doFilter(request, response);
    }
}

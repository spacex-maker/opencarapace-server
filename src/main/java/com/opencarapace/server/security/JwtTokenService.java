package com.opencarapace.server.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtTokenService {

    private static final String HMAC_SHA256 = "HmacSHA256";

    private final Key signingKey;
    private final long accessTokenValiditySeconds;

    public JwtTokenService(
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.jwt.access-token-validity-seconds}") long accessTokenValiditySeconds
    ) {
        /*
         * 使用 SecretKeySpec 从配置的原始字符串构造 HMAC 密钥，避免 jjwt Keys.hmacShaKeyFor
         * 对字节做 Base64 解码（会导致含 '-' 等字符的配置报错）。
         * HS256 要求密钥至少 256 bit（32 字节），请配置足够长的随机字符串。
         */
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("security.jwt.secret 至少需要 32 字节（256 bit），当前长度: " + keyBytes.length);
        }
        this.signingKey = new SecretKeySpec(keyBytes, HMAC_SHA256);
        this.accessTokenValiditySeconds = accessTokenValiditySeconds;
    }

    public String generateToken(String subject, Map<String, Object> claims) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(accessTokenValiditySeconds);
        return Jwts.builder()
                .setSubject(subject)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(expiry))
                .addClaims(claims)
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}


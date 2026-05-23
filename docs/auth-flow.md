# 인증 흐름

## 개요

- access token — 짧은 만료시간, stateless, 매 요청마다 사용
- refresh token — 긴 만료시간, httpOnly 쿠키, Redis 세션과 1:1 대응
- 세션 — `userId:sha256(userId:userAgent)` 키로 Redis 관리

---

## 로그인 (`POST /auth/login`)

```
클라이언트
  → LocalAuthGuard (이메일/비밀번호 검증)
  → LocalStrategy.validate() → AuthService.validateUser()
  → AuthService.login(user, ip, userAgent)
      ├─ UA/IP 없으면 401
      ├─ issueTokenPair() → access token + refresh token 발급
      └─ SessionService.createSession()
            └─ Redis: userId:sessionId → { userId, refreshToken, userAgent, ip, createdAt } (TTL: refreshExpiresIn)
  → 응답: { access_token } + Set-Cookie: refresh_token (httpOnly)
```

---

## 토큰 갱신 (`POST /auth/refresh`)

```
클라이언트 (쿠키에 refresh_token 자동 전송)
  → RefreshGuard (쿠키에서 refresh token 추출 및 서명 검증)
  → RefreshStrategy.validate() → request.user 주입
  → AuthService.refresh(user, refreshToken, userAgent, ip)
      ├─ refresh token 또는 UA/IP 없으면 401
      ├─ SessionService.findSession() → Redis에서 세션 조회
      ├─ 세션 없거나 저장된 토큰과 불일치 → 401
      ├─ issueTokenPair() → 새 토큰 쌍 발급
      └─ SessionService.createSession() → 세션 갱신 (기존 키 덮어씀)
  → 응답: { access_token } + Set-Cookie: refresh_token (갱신)
```

---

## 로그아웃 (`DELETE /auth/logout`)

```
클라이언트 (Authorization: Bearer access_token)
  → JwtAuthGuard (access token 검증)
  → JwtStrategy.validate() → request.user 주입
  → AuthService.logout(user, userAgent)
      ├─ UA 없으면 401
      └─ SessionService.deleteSession() → Redis에서 세션 삭제
  → 응답: 204 + Set-Cookie: refresh_token 제거
```

---

## 세션 ID 생성 방식

```
sessionId = userId + ":" + sha256(userId + ":" + userAgent)
```

동일 유저 + 동일 UA → 동일 sessionId → 재로그인 시 세션 자동 갱신  
다른 UA (다른 브라우저/기기) → 다른 sessionId → 독립적인 세션

---

## 미구현 / 추후 작업

- **탈취 감지** — refresh 요청 시 IP 불일치 또는 토큰 재사용 감지 → 세션 무효화 (`docs/refresh-token-security.md` 참고)
- **전체 로그아웃** — `DELETE /auth/logout/all` → `userId:*` 패턴으로 모든 세션 삭제
- **세션 목록 조회** — 로그인된 기기 목록 확인
- **rate limiting** — 로그인/refresh 엔드포인트 브루트포스 방지

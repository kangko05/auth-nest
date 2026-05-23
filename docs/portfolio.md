# auth-nest2 포트폴리오

---

## 개요

NestJS 기반 독립 인증 서버. 다른 서비스가 인증을 위임할 수 있는 구조를 목표로 한다.

단순히 동작하는 수준을 넘어, 실제 공격 시나리오를 검토하고 각 결정의 근거를 문서화하는 것에 집중했다.

**기술 스택**: NestJS · TypeORM · MySQL · Redis · Passport (JWT/Local/Google OAuth2) · Prometheus

---

## 문제 및 해결 과정

### 1. 토큰 탈취 시나리오 대응

**문제**

JWT는 stateless 특성상 서버가 발급 후 토큰을 취소할 수단이 없다. 사용자가 로그아웃하거나 비밀번호를 바꿔도 이미 발급된 토큰은 만료 전까지 유효하다. 단일 대응으로는 모든 공격을 막을 수 없어 시나리오별로 해결 방법을 검토하고 레이어를 쌓았다.

---

**CSRF — refresh token 쿠키 자동 전송**

refresh token을 httpOnly 쿠키에 저장하면 악의적인 사이트에서 POST 요청을 유도해 브라우저가 쿠키를 자동으로 전송할 수 있다.

→ 쿠키에 `SameSite: lax` 설정. POST 요청은 외부 도메인에서 쿠키를 전송하지 않는다. `strict`는 외부 링크 클릭 후 로그인 유지 같은 정상 패턴도 막아 `lax`를 선택했다.

---

**JWT 알고리즘 혼동 공격**

`alg: none` 공격이나 공개키를 HS256 secret으로 사용해 위조 토큰을 만드는 공격이 가능하다.

→ 발급 시 알고리즘 명시, 검증 시 허용 알고리즘 제한. `jti`(JWT ID)로 토큰마다 고유값을 부여해 동일 시간 발급 시에도 토큰 충돌을 방지한다.

```typescript
// 발급
jwtService.signAsync(
  { jti: randomUUID(), sub: user.id, role: user.role },
  { algorithm: 'HS256' }
)

// 검증 전략
super({ algorithms: ['HS256'], ... })
```

---

**Refresh token 재사용 감지**

탈취된 refresh token으로 갱신 시도 시, 또는 탈취자와 정상 유저가 동시에 갱신 요청을 보낼 때 단순 401 반환만으로는 탈취 여부를 구분하거나 대응할 수 없다.

→ 세션에 refresh token을 함께 저장하고, 갱신 요청 시 저장된 토큰과 비교한다. 불일치하면 해당 세션을 즉시 삭제하고 401을 반환한다. 탈취자가 먼저 갱신하면 세션의 토큰이 새 값으로 교체되므로, 이후 정상 유저의 구 토큰 요청에서 불일치가 발생해 세션이 삭제된다.

```typescript
if (storedSession.refreshToken !== refreshToken) {
  await this.accountService.deleteSession(user, userAgent);
  throw new AppException(ErrorCode.SESSION_NOT_FOUND);
}
```

---

**IP 불일치 감지**

탈취된 refresh token을 전혀 다른 환경(다른 IP)에서 사용하는 경우.

→ 세션 생성 시 IP를 저장하고, 갱신 요청 시 비교한다. 불일치 시 세션을 삭제하고 401을 반환한다. 모바일 네트워크 전환이나 VPN 환경에서 오탐 가능성이 있지만, access token 수명이 짧은 구조에서 감수 가능한 수준으로 판단했다.

---

**로그아웃 후 access token 재사용**

로그아웃해도 이미 발급된 access token은 만료 전까지 유효하다. stateless 특성상 서버에서 즉시 취소할 수단이 없다.

→ 로그아웃 시 access token을 Redis 블랙리스트에 등록하고, 매 요청마다 서명 검증 후 블랙리스트를 조회한다. TTL은 토큰의 잔여 만료 시간으로 설정해 만료된 토큰은 자동으로 삭제된다.

```typescript
// 로그아웃 시
const payload = jwtService.decode(token) as { exp: number };
const remainingTime = payload.exp * 1000 - Date.now();
await accountService.blacklistToken(token, remainingTime);

// JwtAuthGuard
if (await accountService.isBlacklisted(token))
  throw new AppException(ErrorCode.TOKEN_BLACKLISTED);
```

---

**결과 구조**

각 레이어가 독립적으로 실패하고, 하나가 뚫려도 다음 레이어에서 차단된다.

```
ThrottlerGuard (요청 빈도 제한)
  → JwtAuthGuard (서명/만료 검증)
    → Blacklist 조회 (로그아웃된 토큰 차단)
      → Session 조회 (세션 존재 + IP + refresh token 일치)
        → RolesGuard (역할 검증, 해당 엔드포인트만)
```

공격 시나리오가 실제로 차단되는지 e2e 테스트로 검증했다 (토큰 재사용, 로그아웃 후 재시도, IP 불일치 등).

---

### 2. 다중 기기 세션 관리

**문제**

단일 세션 구조에서는 새 기기에서 로그인하면 기존 기기가 로그아웃된다. 특정 기기만 선택적으로 로그아웃하는 것도 불가능하다.

**검토한 방법**

세션 키 생성 방식이 핵심이었다.

| 방법 | 문제 |
|---|---|
| UUID 랜덤 생성 | 같은 기기에서 재로그인 시 기존 세션이 남아 중복 누적 |
| UA + IP 해시 | IP가 유동적(모바일 전환, VPN)이라 같은 기기에서도 키가 달라짐 |
| UA 해시 | 동일 기기 재로그인 시 같은 키 → 자동 갱신, 중복 없음 |

IP는 세션 키에서 제외하되, 세션 데이터 안에 저장해 1번의 탈취 감지 목적으로 활용한다.

**구현**

```
sessionId = userId:sha256(userId:userAgent)
```

같은 유저라도 UA가 다르면 독립 세션이 생성된다. Redis에 JSON으로 저장하고, TTL은 refresh token 만료 시간과 동일하게 설정한다.

```json
{
  "userId:sha256hash": {
    "userId": "uuid",
    "refreshToken": "token_string",
    "userAgent": "Mozilla/5.0...",
    "ip": "127.0.0.1",
    "createdAt": 1234567890
  }
}
```

- 기기별 독립 로그아웃: 해당 키만 삭제
- 전체 로그아웃: `userId:*` 패턴 SCAN 후 전체 삭제
- 동일 기기 재로그인: 같은 키를 덮어써 세션 중복 없음

UA 변경(브라우저 업데이트 등) 시 기존 세션을 찾지 못해 재로그인이 필요한 한계는 있다.

---

## 결과

### 구현 기능 목록

| 기능 | 설명 |
|---|---|
| 이메일/비밀번호 인증 | bcrypt rounds=12, 회원가입/로그인 |
| 토큰 로테이션 | access/refresh token 분리, 갱신 시 rotation |
| 세션 기반 다중 기기 지원 | UA 기반 기기 식별, 선택적/전체 로그아웃 |
| Access token 블랙리스트 | 로그아웃 후 즉시 무효화 |
| Brute force 방어 | 5회 실패 시 30분 임시 잠금, rate limiting |
| 비밀번호 재설정 | 이메일 토큰, Redis TTL 15분, 재사용 방지 |
| Google OAuth2 | 이메일 기준 계정 통합 |
| RBAC | JWT payload role, `@Roles()` 데코레이터 |
| 모니터링 | Prometheus 메트릭, liveness/readiness 헬스 체크 |
| 구조화된 로깅 | Winston, 이벤트별 log/warn 구분 |
| Swagger UI | 비프로덕션 환경에서만 노출 |
| 에러 처리 | 전역 ExceptionFilter, ErrorCode enum 통일 |

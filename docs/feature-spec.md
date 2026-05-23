# 기능 명세서

---

## 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 | 역할 |
|---|---|---|---|---|
| POST | `/auth/register` | 회원가입 | 불필요 | — |
| POST | `/auth/login` | 로그인 | 불필요 | — |
| POST | `/auth/refresh` | 토큰 갱신 | 쿠키 (refresh token) | — |
| DELETE | `/auth/logout` | 로그아웃 | Bearer token | — |
| POST | `/auth/password-reset/request` | 비밀번호 재설정 요청 | 불필요 | — |
| GET | `/auth/password-reset/confirm` | 비밀번호 재설정 폼 | 불필요 | — |
| POST | `/auth/password-reset/confirm` | 비밀번호 재설정 완료 | 불필요 | — |
| GET | `/auth/google` | Google OAuth 시작 | 불필요 | — |
| GET | `/auth/google/callback` | Google OAuth 콜백 | 불필요 | — |
| PUT | `/auth/unlock/:userId` | 계정 임시 잠금 해제 | Bearer token | ADMIN |
| PUT | `/auth/ban/:userId` | 계정 영구 밴 | Bearer token | ADMIN |
| DELETE | `/auth/ban/:userId` | 계정 영구 밴 해제 | Bearer token | ADMIN |
| GET | `/health/live` | 서버 생존 여부 | 불필요 | — |
| GET | `/health/ready` | DB/Redis 연결 상태 | 불필요 | — |
| GET | `/metrics` | Prometheus 메트릭 | 불필요 | — |
| GET | `/api` | Swagger UI (비프로덕션만) | 불필요 | — |

---

## 1. 이메일/비밀번호 인증

### 개요
이메일과 비밀번호로 회원가입 및 로그인하는 기본 인증 방식.

### 도입 배경
OAuth 없이도 동작해야 하는 가장 범용적인 인증 수단. 비밀번호 저장 시 평문 또는 약한 해시를 사용하면 DB 유출 시 즉시 크랙 가능하다.

### 구현 방식
- bcrypt rounds=12로 해시 저장 (10 미만은 brute force에 취약, 14 이상은 응답 지연이 체감됨)
- 비밀번호 강도 조건을 DTO 단에서 검증 (8자 이상, 대소문자/숫자/특수문자 포함)
- 회원가입 응답에 password 미포함 (`UserCreatedDto`: email, createdAt만 반환)
- 로그인 실패 응답을 "이메일 또는 비밀번호 불일치"로 통일 → 어느 쪽이 틀렸는지 노출하지 않아 계정 열거 공격 방어

### 트레이드오프
bcrypt rounds가 높을수록 해시 연산이 느려진다. rounds=12는 보안과 응답 속도의 균형점으로 선택.

### 관련 엔드포인트
- `POST /auth/register`
- `POST /auth/login`

---

## 2. 토큰 로테이션

### 개요
짧은 수명의 access token과 긴 수명의 refresh token을 분리해 보안과 사용성을 함께 확보.

### 도입 배경
access token만 쓰면 서버에서 로그인 상태 유지 등 상태 관리에 어려움이 따른다. 보안을 위해 수명을 짧게 설정하면 만료마다 재로그인이 발생해 사용성이 나빠지고, 수명을 길게 두면 탈취 시 피해 시간이 길어진다.

### 구현 방식
- access token: 짧은 수명, `jti`(JWT ID) + `sub`(userId) + `role` 포함, HS256 알고리즘 명시
- refresh token: 별도 secret, httpOnly + sameSite=lax 쿠키 전달 → JavaScript 접근 불가(XSS 방어), access token 탈취로 refresh token 위조 불가
- 토큰 갱신 시마다 새 refresh token 발급, 세션 갱신 → 이전 토큰 재사용 감지 가능
- 프로덕션 환경에서 secure 쿠키 플래그 활성화

### 트레이드오프
JWT를 쓰면서도 refresh token 관리를 위해 Redis 세션을 함께 두므로 완전한 stateless 구조가 아니다.

### 관련 엔드포인트
- `POST /auth/login`
- `POST /auth/refresh`

---

## 3. 세션 기반 다중 기기 지원

### 개요
기기별 세션을 독립적으로 관리해 특정 기기 로그아웃, 전체 로그아웃을 지원.

### 도입 배경
단일 세션 구조에서는 새 기기에서 로그인하면 기존 기기가 로그아웃된다. 사용자는 여러 기기에서 동시에 로그인 상태를 유지해야 한다.

### 구현 방식
- 세션 키: `userId:sha256(userId:userAgent)` → 같은 유저라도 UA가 다르면 독립 세션
- Redis에 `{ userId, refreshToken, userAgent, ip, createdAt }` JSON으로 저장, TTL = refresh token 만료 시간
- 세션에 refresh token을 포함해 갱신 요청 시 대조 → 재사용 감지
- UA 없이 로그아웃 요청 시 `userId:*` 패턴으로 전체 세션 삭제 (전체 로그아웃)

### 트레이드오프
UA는 브라우저 업데이트나 설정 변경으로 바뀔 수 있어 완벽한 기기 식별자가 아니다. 별도 디바이스 등록 없이 다중 기기를 지원하는 현실적인 방법으로 선택.

### 관련 엔드포인트
- `POST /auth/login`
- `POST /auth/refresh`
- `DELETE /auth/logout`

---

## 4. 로그아웃 후 Access Token 즉시 무효화

### 개요
로그아웃 시 access token을 블랙리스트에 등록해 만료 전에도 사용 불가하게 처리.

### 도입 배경
JWT는 stateless 구조상 서버가 발급 후 취소할 수단이 없다. 로그아웃해도 토큰을 가진 사람은 만료 전까지 계속 요청할 수 있다. 기기 분실이나 탈취 상황에서 로그아웃이 의미 없어진다.

### 구현 방식
- 로그아웃 시 access token을 decode해 `exp` 추출 → 남은 시간(ms)을 TTL로 Redis에 등록
- `JwtAuthGuard`에서 서명 검증 통과 후 블랙리스트 조회 → 등록된 토큰이면 401
- TTL이 지나면 Redis에서 자동 삭제 → 만료된 토큰은 어차피 검증 단계에서 거부되므로 저장 불필요

### 트레이드오프
매 요청마다 Redis 조회가 추가되어 latency가 소폭 증가한다. stateless JWT의 이점이 일부 희석되지만, 로그아웃 즉시 무효화를 보안 요구사항으로 판단해 감수.

### 관련 엔드포인트
- `DELETE /auth/logout`

---

## 5. 계정 잠금

### 개요
로그인 반복 실패 시 임시 잠금, 운영자 판단에 의한 영구 밴을 분리해 처리.

### 도입 배경
제한 없이 로그인을 시도할 수 있으면 brute force 공격이 가능하다. 단, 비밀번호를 잊은 정상 사용자도 실패할 수 있어 무조건 영구 차단은 부적절하다.

### 구현 방식

| | 임시 잠금 | 영구 밴 |
|---|---|---|
| 트리거 | 로그인 5회 실패 | 어드민 수동 처리 |
| 해제 | 30분 후 자동 또는 어드민 해제 | 어드민 수동 해제 |
| 저장 | Redis TTL | DB `isBanned` 컬럼 |

- 실패 카운터 TTL 10분: 10분 간격으로 시도하면 카운터 초기화 → 느린 brute force는 rate limiting이 주로 방어
- 영구 밴은 DB에 저장: Redis는 재시작 시 유실 가능, 영구 처분은 DB에 두어야 유지

### 트레이드오프
IP가 아닌 계정 단위 잠금이므로 공격자가 동일 계정을 여러 IP에서 시도하면 정상 사용자가 잠긴다. IP 차단은 NAT 환경에서 정상 사용자까지 차단할 수 있어 계정 단위 보호를 우선했다.

### 관련 엔드포인트
- `POST /auth/login`
- `PUT /auth/unlock/:userId` (ADMIN)
- `PUT /auth/ban/:userId` (ADMIN)
- `DELETE /auth/ban/:userId` (ADMIN)

---

## 6. Rate Limiting

### 개요
엔드포인트별 요청 빈도를 제한해 자동화 공격과 서버 자원 남용을 방어.

### 도입 배경
제한이 없으면 brute force, credential stuffing 공격이 가능하고 서버 자원이 무제한으로 소모된다.

### 구현 방식
- 전역 기본값: 분당 5회 (회원가입 기준 — 정상 사용에서 빈도가 낮아야 함)
- 엔드포인트별 오버라이드:
  - `POST /auth/refresh`: 30회/분 (자동 갱신이 빈번하게 발생)
  - `DELETE /auth/logout`: 10회/분
- 한도 초과 시 429 반환

### 트레이드오프
IP 기반 제한이므로 NAT 환경에서 같은 IP를 공유하는 정상 사용자가 함께 제한될 수 있다.

### 관련 엔드포인트
- 전체 엔드포인트 전역 적용, refresh/logout은 별도 제한

---

## 7. 비밀번호 재설정

### 개요
이메일로 발송한 토큰을 통해 비밀번호를 재설정하는 흐름.

### 도입 배경
비밀번호를 잊은 사용자가 지원 없이 직접 복구할 수 있어야 한다. 이메일만으로 새 비밀번호를 받으면 이메일 주소를 아는 누구나 타인 계정의 비밀번호를 바꿀 수 있으므로, 이메일 수신 가능 여부를 검증하는 토큰 방식이 필요하다.

### 구현 방식
- `crypto.randomBytes(32).toString('hex')`로 64자 토큰 생성 → 예측 불가능
- Redis에 `password-reset:{token}: email`로 TTL 15분 저장
- Gmail SMTP로 재설정 링크 발송
- 이메일이 존재하지 않아도 동일 응답 반환 → 이메일 존재 여부 노출 방지 (계정 열거 공격 방어)
- 토큰 제출 시 Redis 조회 → 비밀번호 업데이트 → 토큰 즉시 삭제 (재사용 방지)

### 트레이드오프
토큰을 이메일로 전달하므로 이메일 계정이 탈취된 상황에서는 비밀번호 재설정 자체가 공격 수단이 된다. 이메일 계정 보안은 사용자 책임 범위로 판단했고, 토큰 TTL을 15분으로 짧게 유지해 노출 시간을 최소화했다.

### 관련 엔드포인트
- `POST /auth/password-reset/request`
- `GET /auth/password-reset/confirm`
- `POST /auth/password-reset/confirm`

---

## 8. Google OAuth2

### 개요
Google 계정으로 가입 및 로그인. 이메일/비밀번호 계정과 통합.

### 도입 배경
이메일/비밀번호 가입은 입력, 비밀번호 관리 등 허들이 있다. 소셜 로그인으로 진입 장벽을 낮추고, 인증 방식이 달라도 이후 처리를 통일하는 구조가 필요했다.

### 구현 방식
- Google profile에서 이메일과 providerId 추출
- 기존 이메일 계정이 있으면 provider/providerId만 업데이트 (계정 통합)
- 없으면 `password=null`로 신규 생성 (`CreateOauthUserDto` — 비밀번호 필드 없음)
- 인증 방식과 무관하게 이후 세션/토큰 발급 흐름 동일
- 일반 가입과 OAuth 가입은 DTO가 분리돼 있어 일반 가입으로는 비밀번호 없는 계정 생성 불가

### 관련 엔드포인트
- `GET /auth/google`
- `GET /auth/google/callback`

---

## 9. RBAC (역할 기반 접근 제어)

### 개요
ADMIN / USER 두 역할로 엔드포인트 접근을 제어.

### 도입 배경
인증 서버는 계정을 직접 관리한다. 일반 사용자가 잠금 해제, 밴 같은 운영 기능에 접근할 수 없어야 한다. AWS IAM이 인프라 리소스 접근을 역할 기반으로 제어하는 것과 같은 구조를 API 엔드포인트 접근 제어에 적용했다.

### 구현 방식
- JWT payload에 `role` 포함 → 요청마다 DB 조회 없이 권한 확인
- `RolesGuard` + `@Roles()` 데코레이터로 엔드포인트별 선언적 권한 명시
- ADMIN 전용 엔드포인트: 잠금 해제, 영구 밴, 영구 밴 해제

### 트레이드오프
role 변경이 토큰 만료 전까지 즉시 반영되지 않는다. access token 수명이 짧은 구조에서는 감수 가능한 수준.

### 관련 엔드포인트
- `PUT /auth/unlock/:userId`
- `PUT /auth/ban/:userId`
- `DELETE /auth/ban/:userId`

---

## 10. 모니터링

### 개요
Prometheus 메트릭과 헬스체크로 서비스 상태를 관찰.

### 도입 배경
로그는 개별 이벤트를 기록하지만 추세 파악이 어렵다. 메트릭은 시계열로 수집돼 이상 징후를 실시간으로 감지할 수 있다. 헬스체크는 서버 프로세스가 살아있어도 DB나 Redis 연결이 끊어지면 요청 처리가 불가능하다는 문제를 해결한다.

### 구현 방식
- `auth_login_total { status: success | failed | locked | banned }` — 로그인 결과별 카운터
- `auth_register_total { status: success | duplicate }` — 회원가입 결과 카운터
- `auth_active_sessions_total` — 현재 활성 세션 수 (Gauge)
- `GET /health/live` — 서버 프로세스 생존 여부 (`{ status: 'ok' }`)
- `GET /health/ready` — DB(`SELECT 1`), Redis(`PING`) 각각 독립 확인

### 관련 엔드포인트
- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

---

## 11. Swagger

### 개요
코드 기반으로 API 문서를 자동 생성하고 브라우저에서 직접 테스트할 수 있는 UI 제공.

### 도입 배경
API 문서를 별도로 작성하면 코드가 바뀔 때 문서도 같이 관리해야 한다. 코드와 문서를 같은 곳에서 관리하면 동기화 비용이 줄어든다.

### 구현 방식
- `NODE_ENV !== 'production'`일 때만 활성화 → 프로덕션에서 API 스펙 외부 노출 방지
- `GET /api`에서 UI 접근
- `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` 데코레이터로 엔드포인트별 명세
- `@ApiProperty`로 DTO 필드 문서화

### 관련 엔드포인트
- `GET /api` (비프로덕션 환경만)

---

## 12. 로깅

### 개요
Winston 기반 구조화 로깅과 HTTP 요청/응답 자동 로깅.

### 도입 배경
console.log는 로그 레벨 구분이 없고 포맷이 일정하지 않아 운영 환경에서 문제 추적이 어렵다.

### 구현 방식
- Winston을 NestJS 로거로 교체 — timestamp, colorize, simple 포맷
- `LoggingInterceptor` 전역 등록 — 모든 요청에 대해 `METHOD URL statusCode responseTime` 자동 로깅
- 인증 이벤트별 레벨 구분: 로그인 성공/로그아웃 → `log`, 실패/잠금/밴 감지 → `warn`

---

## 13. 에러 처리

### 개요
전역 예외 필터로 모든 HTTP 예외를 일관된 포맷으로 반환.

### 도입 배경
에러 응답 포맷이 엔드포인트마다 다르면 클라이언트가 처리하기 어렵다.

### 구현 방식
- `HttpExceptionFilter` 전역 등록
- 에러 응답 포맷: `{ statusCode, errorCode, message, timestamp, path }`
- 도메인별 에러 코드 상수 정의 (`EMAIL_ALREADY_EXISTS`, `TOKEN_BLACKLISTED`, `SESSION_NOT_FOUND` 등)
- `AppException`으로 에러 코드를 포함한 예외 생성

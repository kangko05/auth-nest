# 기술 명세서

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 런타임 | Node.js |
| 프레임워크 | NestJS |
| 언어 | TypeScript |
| ORM | TypeORM |
| DB | MySQL |
| 캐시/세션 | Redis (ioredis) |
| 인증 | Passport (local, jwt, refresh, google) |
| 메일 | Nodemailer (Gmail SMTP) |
| 모니터링 | Prometheus + Grafana |
| 로깅 | Winston |
| 테스트 | Jest (단위), Supertest (e2e) |

---

## 아키텍처

### 모듈 구조

```
AppModule
├── ConfigModule        환경변수 로드 및 검증
├── DatabaseModule      TypeORM DataSource 초기화
├── RedisModule         ioredis 클라이언트
├── UsersModule         User 엔티티, 사용자 CRUD
├── AccountModule       세션, 블랙리스트, 계정 잠금
├── AuthModule          인증 로직, Passport 전략, 컨트롤러
├── MailModule          비밀번호 재설정 이메일 발송
├── HealthModule        liveness/readiness 체크
└── PrometheusModule    메트릭 수집
```

### 전역 등록 항목

| 항목 | 역할 |
|---|---|
| `HttpExceptionFilter` | 공통 에러 응답 포맷 |
| `ThrottlerGuard` | 전역 rate limiting |
| `LoggingInterceptor` | HTTP 요청/응답 로깅 |

---

## 데이터 모델

### User

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | PK, 자동 생성 |
| `email` | varchar (unique) | 이메일 |
| `password` | varchar (nullable) | bcrypt 해시, OAuth 전용 계정은 null |
| `role` | enum (admin/user) | 기본값 user |
| `isBanned` | boolean | 영구 밴 여부, 기본값 false |
| `provider` | varchar (nullable) | OAuth 제공자 (google 등) |
| `providerId` | varchar (nullable) | OAuth 제공자의 사용자 ID |
| `createdAt` | datetime | 생성 시각 |
| `updatedAt` | datetime | 수정 시각 |

---

## 외부 의존성

| 의존성 | 용도 |
|---|---|
| MySQL | 사용자 데이터 영구 저장 |
| Redis | 세션, 블랙리스트, 계정 잠금, 비밀번호 재설정 토큰 |
| Gmail SMTP | 비밀번호 재설정 이메일 발송 |
| Google OAuth | 소셜 로그인 |

---

## 인프라 요구사항

- MySQL 서버
- Redis 서버
- Gmail 앱 비밀번호 (SMTP 인증)
- Google OAuth 클라이언트 ID/Secret (OAuth 사용 시)
- Prometheus 서버 + Grafana (모니터링 사용 시)

---

## 보안 정책

| 항목 | 값 | 비고 |
|---|---|---|
| bcrypt rounds | 12 | 비밀번호 해시 강도 |
| access token 알고리즘 | HS256 | 알고리즘 명시로 alg:none 공격 방어 |
| access token 만료 | 환경변수 (`JWT_EXPIRES_IN`) | 기본값 60초, 실제 환경에서는 요구사항에 맞게 조정 필요 |
| refresh token 만료 | 환경변수 (`REFRESH_EXPIRES_IN`) | 기본값 7일, 실제 환경에서는 요구사항에 맞게 조정 필요 |
| refresh token 전달 | httpOnly + sameSite=lax 쿠키 | 프로덕션에서 secure 플래그 추가 |
| 로그인 실패 잠금 | 5회 실패 시 30분 잠금 | 실패 카운터 TTL 10분 |
| 비밀번호 재설정 토큰 TTL | 15분 | |
| rate limit 기본값 | 분당 5회 | refresh 30회, logout 10회 오버라이드 |

---

## 에러 코드

| 코드 | HTTP | 메시지 |
|---|---|---|
| `EMAIL_ALREADY_EXISTS` | 409 | 이미 사용 중인 이메일입니다. |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호가 올바르지 않습니다. |
| `ACCOUNT_LOCKED` | 401 | 계정이 잠겨 있습니다. |
| `ACCOUNT_BANNED` | 403 | 영구 정지된 계정입니다. |
| `TOKEN_BLACKLISTED` | 401 | 유효하지 않은 토큰입니다. |
| `SESSION_NOT_FOUND` | 401 | 세션이 존재하지 않습니다. |
| `IP_MISMATCH` | 401 | 비정상적인 접근이 감지되었습니다. |
| `USER_NOT_FOUND` | 404 | 존재하지 않는 유저입니다. |
| `INVALID_TOKEN` | 400 | 유효하지 않거나 만료된 토큰입니다. |

### 에러 응답 포맷

```json
{
  "statusCode": 401,
  "errorCode": "TOKEN_BLACKLISTED",
  "message": "유효하지 않은 토큰입니다.",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/auth/logout"
}
```

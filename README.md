# auth-nest

NestJS 기반 독립 인증 서버. 다른 서비스가 인증을 위임할 수 있는 구조를 목표로 한다.

## 기술 스택

- **Framework**: NestJS
- **Database**: MySQL + TypeORM
- **Cache/Session**: Redis (ioredis)
- **Auth**: Passport (Local / JWT / Google OAuth2)
- **Monitoring**: Prometheus + Grafana
- **Test**: Jest (단위) / Supertest (e2e)

## 주요 기능

- 이메일/비밀번호 회원가입 및 로그인
- Access token + Refresh token 로테이션
- 세션 기반 다중 기기 지원 (기기별 독립 로그아웃)
- Access token 블랙리스트 (로그아웃 후 즉시 무효화)
- Brute force 방어 (계정 잠금 + Rate Limiting)
- 비밀번호 재설정 (이메일 토큰)
- Google OAuth2 (이메일 기준 계정 통합)
- RBAC (역할 기반 접근 제어)
- Prometheus 메트릭 / 헬스 체크

## 실행

**필요 환경**: MySQL, Redis

```bash
npm install
npm run start:dev
```

**테스트**

```bash
npm test          # 단위 테스트

# e2e: docker compose로 MySQL/Redis 기동 후 실행
docker compose --env-file .env.test up -d
npm run test:e2e
```

**환경변수** (`.env.test` 기준)

```
DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
JWT_SECRET, JWT_EXPIRES_IN
REFRESH_SECRET, REFRESH_EXPIRES_IN
REDIS_HOST, REDIS_PORT
```

## 문서

| 문서 | 설명 |
|---|---|
| [overview](docs/overview.md) | 프로젝트 개요, 핵심 문제 해결 과정, 구현 기능 목록 |
| [기능 명세](docs/feature-spec.md) | 엔드포인트별 기능 설명, 설계 결정, 트레이드오프 |
| [기술 명세](docs/tech-spec.md) | 아키텍처, 데이터 모델, 보안 정책, 에러 코드 |
| [설정](docs/config-setup.md) | CORS, Helmet, ValidationPipe, 환경변수 검증 |
| [보완 항목](docs/todo.md) | 미구현 항목 및 개선 방향 |
| [이슈 로그](docs/issues/) | 설계 결정 배경 및 트레이드오프 (6개) |

# 보완 및 추가 작업 목록

## 기능 (순서대로)

- [x] Rate Limiting
- [x] 계정 잠금 (TTL 자동 해제)
- [x] Role 시스템 — 관리자 역할, 계정 잠금 해제 엔드포인트, 영구 밴
- [x] OAuth 2.0 — Google 소셜 로그인 (passport-google-oauth20)
- [x] 로그아웃 후 access token 즉시 무효화 — 블랙리스트로 처리
- [x] 비밀번호 재설정
- [ ] Race Condition — 토큰 갱신 시 Redis Lua 스크립트로 atomic 처리
- [ ] 웹 전용 / 내부망 서비스 모듈 분리
  - 내부망은 API key 기반 또는 gRPC 컨트롤러 추가 (AuthService는 공유)
  - `GET /auth/verify` JWT 검증 엔드포인트는 여기서 구현
  - NestJS hybrid application으로 HTTP + gRPC 동시 지원 가능

## 코드 수정 (기능 마무리 후)

- [ ] 비밀번호 재설정 성공 시 `deleteAllUserSessions()` 호출 — 탈취된 세션 차단
- [ ] `tokenValidAfter` 또는 `tokenVersion` 도입 — 비밀번호 재설정 시 이전 발급 access token 일괄 무효화. `JwtStrategy.validate()`에서 토큰 `iat`와 비교해 401 처리
- [ ] 비밀번호 재설정 confirm DTO 추가 — `newPassword` 강도 검증
- [ ] `/password-reset/confirm` GET 핸들러 XSS 수정 — token HTML 직접 삽입 제거
- [ ] `req.ip` trust proxy 설정 — reverse proxy 환경에서 실제 클라이언트 IP 획득
- [ ] `GET /auth/verify` 구현 — 인증 위임 서버 핵심 엔드포인트


- [x] `main.ts` — `ValidationPipe`에 `whitelist: true`, `forbidNonWhitelisted: true` 추가
- [ ] 이메일 정규화 — register/login 시 소문자 변환
- [x] 환경변수 검증 — Joi로 필수값 검증, 서버 시작 시 에러 발생
- [x] `auth.service.ts` — `logout`의 `jwtService.decode` try/catch 추가
- [x] `validateUser` — 잠금 체크와 bcrypt 순차 처리로 변경
- [x] `validateUser` — `isBanned` 체크 추가
- [x] `secure` 쿠키 옵션 — `NODE_ENV=production`이면 true
- [x] 로그 메시지 — session not found/토큰 불일치 로그 수정
- [x] Swagger — API 문서화
- [ ] JWT 키 로테이션 — 주기적으로 서명 키 교체, 유출 시 피해 최소화
- [ ] 비밀번호 재설정 confirm 응답 형식 통일 — 현재 성공은 HTML, 실패는 JSON

## 테스트 (기능 마무리 후)

- [ ] `AuthController` 단위 테스트 — Guard 적용 여부, 응답 형식
- [ ] Strategy 테스트 — `LocalStrategy`, `JwtStrategy`, `RefreshStrategy`

## 배포 (도커 구성 완성 후)

- [ ] 배포 환경 명세 작성 — 포트, 컨테이너 구성, 환경별 설정 차이 (`tech-spec.md`에 추가)
- [ ] 앱 서버 Dockerfile 작성
- [ ] docker-compose 구성 — 앱 서버 + MySQL + Redis + Prometheus + Grafana

## 운영 (기능 마무리 후)

- [x] 로깅 — Winston 기반, 애플리케이션/액세스/감사 로그
- [x] CORS 설정
- [x] Helmet (보안 헤더)
- [x] 에러 중앙 처리 — `ExceptionFilter`
- [x] 헬스체크 — `GET /health/live`, `GET /health/ready` (DB/Redis)
- [ ] 에러 추적 (Sentry 등)
- [x] 메트릭 수집 — Prometheus + Grafana (`@willsoto/nestjs-prometheus`) — NestJS 연동 완료, Docker(Prometheus/Grafana) 설정 미완
- [ ] 분산 추적 — Jaeger 또는 Zipkin (서비스 간 요청 흐름 추적)
- [ ] AWS Role 구성 적용

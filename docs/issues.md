# Issues

## Critical

- [ ] **XSS** `auth.controller.ts:141` — `token` 쿼리파라미터 HTML escape 없이 삽입
- [ ] **이메일 URL 하드코딩** `mail.service.ts:12` — `http://localhost:3000` 고정, 운영 시 링크 깨짐. `FRONTEND_URL` env var로 교체
- [ ] **confirmResetPassword DTO 없음** `auth.controller.ts:156` — 플레인 객체라 ValidationPipe 미작동, 빈/약한 비밀번호 설정 가능
- [ ] **resetPassword @IsEmail 없음** `auth.controller.ts:135` — `ResetPasswordDto` 안 쓰고 플레인 객체 사용, 이메일 형식 검증 없음

## High

- [ ] **타이밍 공격** `auth.service.ts:97` — 유저 없으면 bcrypt 스킵, 응답 시간으로 이메일 열거 가능
- [ ] **Google OAuth isBanned 미체크** `google.strategy.ts:22` — 밴된 유저 Google 로그인 가능
- [ ] **JwtStrategy isBanned 미체크** `jwt.strategy.ts:23` — DB 조회하면서 `isBanned` 안 봄, 밴 후 기존 JWT 유효
- [ ] **블랙리스트 TTL 음수** `auth.service.ts:182` — 만료된 토큰 로그아웃 시 음수 PX → Redis 에러

## Medium

- [ ] **password-reset/request rate limit 없음** `auth.controller.ts:134` — 전용 `@Throttle` 없음, 이메일 발송 남용 가능
- [ ] **Google OAuth 콜백 JSON 반환** `auth.controller.ts:218` — 브라우저 플로우인데 redirect 없이 `access_token` JSON 노출
- [ ] **createOrUpdateOauthUser 레이스 컨디션** `users.service.ts:31` — 동시 요청 시 unique 제약 오류
- [ ] **deleteAllUserSessions SCAN 누락** `session.service.ts:59` — 고부하 시 `scanStream` 키 누락 가능, 세션 인덱스 필요
- [ ] **googleConfig().enabled DI 밖 호출** `auth.module.ts:52` — ConfigModule 초기화 전 `process.env` 직접 읽음

## Low

- [ ] **console.log in verify** `auth.controller.ts:237` — logger로 교체 또는 제거
- [ ] **/auth/verify + /internal/verify 중복** — 동일 로직 두 곳, 하나로 통일
- [ ] **에러 응답 latency 미로깅** `logging.interceptor.ts:26` — `tap()`은 성공만, 에러 latency 누락
- [ ] **GET / 노출** `app.controller.ts` — `"Hello World!"` 외부 노출

## 운영

- [ ] **DB 마이그레이션 없음** — TypeORM migration 파일 없음
- [ ] **HTTPS / nginx 없음** — `secure` 쿠키 무의미
- [ ] **로그 집계 없음** — Winston 콘솔만, JSON 포맷 아님
- [ ] **요청 추적 ID 없음** — correlation ID 없음
- [ ] **Prometheus alerting rule 없음** — 메트릭은 있는데 알림 없음
- [ ] **auth_active_sessions_total 게이지 부정확** — 인스턴스 메모리 카운트, 멀티 인스턴스 시 틀어짐
- [ ] **DB 백업 전략 없음** — 볼륨 마운트/백업 스케줄 없음

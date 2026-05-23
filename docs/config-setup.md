# 설정 항목 정리

기능 명세에서 제외한 설정 수준 항목들.

---

## CORS

`main.ts`에서 `enableCors()` 설정.

```
origin: process.env.ALLOWED_ORIGIN
methods: ['POST', 'PUT', 'DELETE']
allowedHeaders: ['Content-Type', 'Authorization']
credentials: true
```

`ALLOWED_ORIGIN`은 Joi 필수값으로 검증됨.

---

## Helmet

`main.ts`에서 `app.use(helmet())`.

보안 헤더 자동 설정 (X-Content-Type-Options, X-Frame-Options 등).

---

## ValidationPipe

`main.ts`에서 전역 등록.

```
whitelist: true           // DTO에 없는 필드 제거
forbidNonWhitelisted: true // DTO에 없는 필드 있으면 400 반환
```

---

## 환경변수 검증

`config.module.ts`에서 Joi 스키마로 검증. 누락 시 서버 시작 실패.

필수값: `JWT_SECRET`, `REFRESH_SECRET`, `DB_USER`, `DB_PASS`, `DB_NAME`, `ALLOWED_ORIGIN`

선택값: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `MAIL_USER`, `MAIL_PASS`

환경별 `.env.{NODE_ENV}` 파일 자동 로드.

---

## Graceful Shutdown

- `DatabaseModule.onApplicationShutdown()` — DataSource 연결 종료
- `RedisModule.onApplicationShutdown()` — Redis 연결 종료

서버 종료 시 열린 커넥션 정리.

# Brute Force 방어 — 계정 잠금 + Rate Limiting

## 문제 상황

로그인 엔드포인트에 제한이 없으면 자동화된 요청으로 비밀번호를 무한 시도할 수 있다. 이를 방치하면 계정 탈취 가능성이 높아지고 서버 자원도 무제한으로 소모된다.

단순히 요청 빈도만 제한하거나 계정만 잠그는 단일 대응으로는 한계가 있어 두 가지를 함께 적용했다.

---

## 계정 잠금

### 검토한 방법들

**IP 기반 차단**

공격자의 IP를 차단하면 NAT 환경에서 같은 IP를 공유하는 정상 사용자까지 차단된다. IP 우회도 쉬워 실효성이 낮다.

**계정 단위 잠금 (채택)**

특정 계정에 실패가 반복되면 해당 계정을 잠근다. IP와 무관하게 계정을 보호하고, 정상 사용자에게도 비밀번호 오타 등 실패 여유를 준다.

### 임시 잠금 vs 영구 밴 분리

영구 차단만 있으면 비밀번호를 잊은 정상 사용자도 계속 고객 지원을 요청해야 한다. 두 단계로 분리했다.

| | 임시 잠금 | 영구 밴 |
|---|---|---|
| 트리거 | 로그인 5회 실패 | 어드민 수동 처리 |
| 해제 | 30분 후 자동 또는 어드민 해제 | 어드민 수동 해제 |
| 저장 | Redis TTL | DB `isBanned` 컬럼 |

영구 밴을 Redis가 아닌 DB에 저장한 이유: Redis는 재시작 시 데이터가 유실될 수 있어 영구 처분은 DB에 두어야 유지된다.

### 수치 기준

| 항목 | 값 | 근거 |
|---|---|---|
| 실패 허용 횟수 | 5회 | 오타 등 정상 실패를 감안한 최소한의 여유. 그 이상은 자동화 공격으로 간주 |
| 실패 카운터 TTL | 10분 | 짧은 시간 내 집중 시도 감지. 10분이 지나면 카운터 초기화 |
| 잠금 시간 | 30분 | 공격자의 재시도 비용을 높이면서 정상 사용자 불편 최소화 |

수치는 코드에 고정. 보안 수치를 환경변수로 외부에 노출하는 것은 적절하지 않다고 판단.

### 구현

```typescript
async incrementAccFailCount(user: User) {
  const newCnt = await this.redisClient.incr(accFailKey);
  if (newCnt == 1) await this.redisClient.expire(accFailKey, 600); // 10분
  if (newCnt >= 5) {
    await this.redisClient.set(accLockKey, '1', 'EX', 1800); // 30분
  }
}
```

**미구현 — Race Condition**

`INCR`과 `EXPIRE`가 분리돼 있어 프로세스가 사이에 죽으면 TTL이 설정되지 않아 카운터가 영구 남을 수 있다. Lua 스크립트로 atomic하게 처리 필요.

---

## Rate Limiting

### 검토한 방법들

계정 잠금만으로는 느린 brute force(10분 간격으로 시도해 카운터를 초기화하면서 공격)를 막기 어렵다. 요청 빈도 자체를 제한해야 한다.

**in-memory 카운터**

서버 인스턴스마다 카운트가 독립적이라 수평 확장 시 제한이 무력화된다.

**Redis 기반 카운터**

분산 환경에서도 공유 카운터로 일관된 제한 가능.

**`@nestjs/throttler` (채택)**

기본 in-memory storage 제공. Redis storage로 교체 가능한 구조. 엔드포인트별 오버라이드도 지원해 유연하다.

### 적용 기준

전역 기본값을 회원가입 기준으로 낮게 설정하고, 자동 갱신이 빈번한 refresh는 높게 오버라이드했다.

| 엔드포인트 | 제한 |
|---|---|
| 전체 (기본값) | 분당 5회 |
| `POST /auth/refresh` | 분당 30회 |
| `DELETE /auth/logout` | 분당 10회 |

### e2e 테스트 충돌 문제

같은 앱 인스턴스에서 요청이 누적되면 throttler 한도에 걸려 이후 테스트가 전부 실패하는 문제가 있었다.

**해결 방법**

1. `.env.test`에서 `THROTTLE_LIMIT`을 충분히 높게 설정 → 일반 테스트는 throttler에 걸리지 않음
2. throttler 동작 검증 테스트는 `overrideProvider`로 낮은 limit 직접 주입

```typescript
.overrideProvider('THROTTLER:MODULE_OPTIONS')
.useValue([{ ttl: 60000, limit: 2 }])
```

`'THROTTLER:MODULE_OPTIONS'`는 `@nestjs/throttler` 내부 토큰. 버전 업그레이드 시 토큰명이 바뀔 수 있어 확인 필요.

---

## 결과

계정 잠금과 rate limiting을 중첩 적용해 단기 집중 공격(계정 잠금)과 느린 지속 공격(rate limiting) 모두 방어. 정상 사용자는 제한에 걸리지 않는 수준으로 수치 설정.

IP 기반 rate limiting이라 NAT 환경에서 같은 IP를 공유하는 정상 사용자가 함께 제한될 수 있는 한계는 있다.

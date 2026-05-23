# RBAC (역할 기반 접근 제어)

## 문제 상황

모든 사용자가 동일한 권한을 가지면 일반 사용자가 계정 잠금 해제, 영구 밴 같은 운영 기능에 접근할 수 있다. 인증 서버는 사용자 계정을 직접 다루는 만큼 권한 분리가 필수다.

권한이 분리되면 운영자 기능이 일반 사용자에게 노출되지 않고, 서비스 운영 통제권을 유지할 수 있다. 권한 분리는 보안 감사 시 기본 요건이기도 하다.

---

## 설계 결정

### IAM 개념 적용

AWS IAM이 인프라 리소스 접근을 역할 기반으로 제어하는 것과 같은 구조를 API 엔드포인트 접근 제어에 적용했다. 구조는 같고 적용 대상이 다르다. 권한을 롤에 묶고, 롤을 사용자에게 부여하는 방식(RBAC).

### JWT payload에 role 포함

```typescript
this.jwtService.signAsync(
  { jti: randomUUID(), sub: user.id, role: user.role },
  { algorithm: 'HS256' }
)
```

매 요청마다 DB에서 role을 조회하는 방식도 있지만, JWT payload에 포함하면 추가 조회 없이 권한을 확인할 수 있다. 즉시 반영이 필요하면 DB 조회 방식으로 전환.

### 선언적 권한 명시

`RolesGuard` + `@Roles()` 데코레이터로 엔드포인트별 권한을 코드에 명시적으로 표현한다.

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Put('/unlock/:userId')
unlockUserAccount() { ... }
```

### ADMIN 전용 엔드포인트

| 엔드포인트 | 설명 |
|---|---|
| `PUT /auth/unlock/:userId` | 임시 잠금 해제 |
| `PUT /auth/ban/:userId` | 영구 밴 |
| `DELETE /auth/ban/:userId` | 영구 밴 해제 |

---

## 결과

일반 사용자가 ADMIN 엔드포인트 접근 시 403 반환. 엔드포인트별 선언적 권한 명시로 역할 추가 시 데코레이터만 변경하면 된다.

---

## 트레이드오프

JWT payload에 role을 포함하므로 role 변경이 토큰 만료 전까지 즉시 반영되지 않는다. access token 수명이 짧은 구조에서는 감수 가능한 수준.

# 비밀번호 재설정 후 기존 Access Token 무효화

## 문제 상황

비밀번호 재설정 성공 시 모든 세션(refresh token)은 Redis에서 삭제할 수 있다. 그런데 이미 발급된 access token은 로그아웃 이벤트가 발생하지 않았기 때문에 블랙리스트에 올릴 방법이 없다.

결과적으로 access token이 탈취된 상황에서 사용자가 비밀번호를 변경해도, 공격자는 탈취한 access token을 만료 시간까지 계속 사용할 수 있다.

---

## 왜 블랙리스트로는 해결이 안 되는가

현재 블랙리스트는 "로그아웃된 토큰"을 등록하는 방식이다. 토큰 자체를 Redis에 key로 저장하기 때문에:

- 탈취된 토큰처럼 로그아웃 이벤트가 없는 토큰은 블랙리스트에 올라가지 않는다.
- 비밀번호 재설정 시점에 발급된 토큰이 몇 개인지 서버가 알 수 없으므로 일괄 등록도 불가능하다.

---

## 설계 결정 — tokenValidAfter

### 접근 방식

"이 토큰을 막겠다" 대신 "이 시각 이전 토큰은 전부 무효"로 방향을 바꾼다.

`User` 엔티티에 `tokenValidAfter(DateTime, nullable)` 컬럼을 추가한다.

- 비밀번호 재설정 성공 시: `tokenValidAfter = now` 로 갱신 + 전체 세션 삭제
- `JwtStrategy.validate()` 에서: DB에서 유저 조회 후 `token.iat < tokenValidAfter` 이면 401 반환

```typescript
// JwtStrategy.validate()
const user = await this.usersService.findByUserId(payload.sub);
if (!user) throw new UnauthorizedException();

if (user.tokenValidAfter && payload.iat < user.tokenValidAfter.getTime() / 1000) {
  throw new UnauthorizedException();
}
```

### 왜 tokenVersion이 아닌 tokenValidAfter인가

`tokenVersion`(정수 카운터)도 동일한 목적으로 사용할 수 있다. 둘을 비교하면:

| | tokenValidAfter | tokenVersion |
|---|---|---|
| 저장 타입 | DateTime | Integer |
| 비교 방법 | `iat < tokenValidAfter` | `token.ver !== user.version` |
| 추가 정보 | 무효화 시각 자체가 데이터 | 버전 번호만 저장 |

`iat`는 JWT 표준 클레임이라 토큰에 이미 포함되어 있다. `tokenVersion`을 쓰려면 토큰 발급 시 `ver` 클레임을 별도로 추가해야 한다. `tokenValidAfter`는 기존 `iat`를 그대로 활용하므로 토큰 구조 변경이 없다는 점에서 선택했다.

### 성능 고려

`JwtStrategy.validate()`는 인증이 필요한 모든 요청에서 실행된다. 기존에는 `payload`만 반환했으나, 이 변경으로 매 요청마다 DB 조회가 추가된다.

트래픽이 높아지면 Redis에 `tokenValidAfter`를 캐싱해 DB 부하를 낮출 수 있다. 현재는 단순하게 DB 직접 조회로 구현한다.

---

## 결과

탈취된 access token이 몇 개든, 비밀번호 재설정 시각 이전에 발급된 토큰은 전부 한 번에 차단된다. 블랙리스트처럼 개별 토큰을 추적할 필요가 없다.

refresh token은 세션 전체 삭제로, access token은 `tokenValidAfter` 비교로 이중 차단된다.

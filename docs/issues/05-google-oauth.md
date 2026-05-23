# Google OAuth2

## 문제 상황

이메일/비밀번호 가입은 입력, 비밀번호 관리 등 여러 단계를 거쳐야 한다. 진입 장벽이 높을수록 가입 중간에 이탈하는 사용자가 많아진다.

Google 계정 하나로 원클릭 가입 및 로그인이 가능하면 비밀번호를 기억하거나 관리할 필요가 없고, 가입까지의 마찰이 크게 줄어든다. 신규 사용자 전환율을 높이고 서비스 편의성을 증대할 수 있다.

---

## 설계 결정

### 계정 통합 방식

Google 인증 후 받은 profile에서 이메일을 추출해 계정을 식별한다.

- 기존 이메일 계정이 있으면 provider/providerId만 업데이트 → 같은 계정으로 통합
- 없으면 `password=null`로 신규 계정 생성

이메일 기준으로 통합한 이유: 사용자 입장에서 이메일이 같으면 같은 계정으로 인식하는 것이 자연스럽다. 인증 방식마다 별도 계정을 만들면 동일 사용자가 중복 계정을 갖게 된다.

```typescript
async createOrUpdateOauthUser(dto: CreateOauthUserDto) {
  const existing = await this.findByEmail(dto.email);
  if (existing) {
    await this.userRepository.update(existing.id, {
      provider: dto.provider,
      providerId: dto.providerId,
    });
    return { ...existing, provider: dto.provider, providerId: dto.providerId };
  }
  return this.create(dto); // password=null
}
```

### 인증 방식 통일

OAuth 로그인 성공 후 이메일/비밀번호 로그인과 동일한 세션/토큰 발급 흐름을 사용한다. 인증 방식이 늘어나도 이후 처리 로직은 변경 불필요.

```
Google 인증 완료
  → GoogleStrategy.validate() → createOrUpdateOauthUser()
  → AuthService.login() ← 이메일/비밀번호 로그인과 동일
  → 세션 생성, 토큰 발급
```

### 단일 장애점 회피

Google 서비스 장애 시 OAuth 로그인이 불가능하다. 이메일/비밀번호 로그인을 병행 제공해 단일 장애점을 회피한다.

---

## 결과

이메일 기준 계정 통합으로 가입 방식에 관계없이 동일 계정으로 로그인 가능. 인증 방식 추가 시 이후 처리 로직 변경 없이 전략(Strategy)만 추가하면 된다.

---

## 미처리 항목 (todo)

콜백 성공 후 현재 JSON 응답 반환. 실제 웹 클라이언트 연동 시 `redirect_uri`로 토큰을 전달하는 처리 필요.

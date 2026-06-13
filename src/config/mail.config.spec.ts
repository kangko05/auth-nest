import mailConfig from './mail.config';

const ENV_KEYS = ['MAIL_USER', 'MAIL_PASS'];

describe('mailConfig', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    });
  });

  it('환경변수 없으면 enabled: false', () => {
    const config = mailConfig();

    expect(config.enabled).toBe(false);
  });

  it('일부만 설정돼도 enabled: false', () => {
    process.env.MAIL_USER = 'user@test.com';

    const config = mailConfig();

    expect(config.enabled).toBe(false);
  });

  it('전부 설정되면 enabled: true', () => {
    process.env.MAIL_USER = 'user@test.com';
    process.env.MAIL_PASS = 'pass';

    const config = mailConfig();

    expect(config.enabled).toBe(true);
    expect(config.user).toBe('user@test.com');
    expect(config.pass).toBe('pass');
  });
});

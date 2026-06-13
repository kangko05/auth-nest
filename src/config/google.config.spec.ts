import googleConfig from './google.config';

const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];

describe('googleConfig', () => {
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
    const config = googleConfig();

    expect(config.enabled).toBe(false);
  });

  it('일부만 설정돼도 enabled: false', () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';

    const config = googleConfig();

    expect(config.enabled).toBe(false);
  });

  it('전부 설정되면 enabled: true', () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost/callback';

    const config = googleConfig();

    expect(config.enabled).toBe(true);
    expect(config.clientId).toBe('id');
    expect(config.clientSecret).toBe('secret');
    expect(config.callbackUrl).toBe('http://localhost/callback');
  });
});

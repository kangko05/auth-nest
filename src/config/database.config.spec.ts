import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import databaseConfig from './database.config';

const ENV_KEYS = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'];

describe('databaseConfig', () => {
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

  it('환경변수 없을 때 기본값 사용', () => {
    const config = databaseConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(3306);
    expect(config.username).toBe('root');
    expect(config.password).toBe('root');
    expect(config.database).toBe('test');
  });

  it('.env.test 파일 값을 올바르게 읽어옴', () => {
    const envConfig = dotenv.config({
      path: path.resolve(process.cwd(), '.env.test'),
    });

    const config = databaseConfig();

    expect(config.host).toBe(envConfig.parsed?.DB_HOST);
    expect(config.port).toBe(Number(envConfig.parsed?.DB_PORT));
    expect(config.username).toBe(envConfig.parsed?.DB_USER);
    expect(config.password).toBe(envConfig.parsed?.DB_PASS);
    expect(config.database).toBe(envConfig.parsed?.DB_NAME);
  });

  it('동적으로 생성한 .env 파일 값을 올바르게 읽어옴', () => {
    const tempEnvPath = path.resolve(process.cwd(), '.env.temp-test');
    const envContent = [
      'DB_HOST=dynamic-host',
      'DB_PORT=5555',
      'DB_USER=dynamic-user',
      'DB_PASS=dynamic-pass',
      'DB_NAME=dynamic-db',
    ].join('\n');

    fs.writeFileSync(tempEnvPath, envContent);

    try {
      const envConfig = dotenv.config({ path: tempEnvPath });
      const config = databaseConfig();

      expect(config.host).toBe(envConfig.parsed?.DB_HOST);
      expect(config.port).toBe(Number(envConfig.parsed?.DB_PORT));
      expect(config.username).toBe(envConfig.parsed?.DB_USER);
      expect(config.password).toBe(envConfig.parsed?.DB_PASS);
      expect(config.database).toBe(envConfig.parsed?.DB_NAME);
    } finally {
      fs.unlinkSync(tempEnvPath);
    }
  });

  it('환경변수로 모든 값 오버라이드', () => {
    process.env.DB_HOST = 'custom-host';
    process.env.DB_PORT = '5432';
    process.env.DB_USER = 'custom-user';
    process.env.DB_PASS = 'custom-pass';
    process.env.DB_NAME = 'custom-db';

    const config = databaseConfig();

    expect(config.host).toBe('custom-host');
    expect(config.port).toBe(5432);
    expect(config.username).toBe('custom-user');
    expect(config.password).toBe('custom-pass');
    expect(config.database).toBe('custom-db');
  });
});

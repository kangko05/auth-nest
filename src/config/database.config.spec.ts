import databaseConfig from './database.config';

describe('databaseConfig', () => {
  it('loads default values', () => {
    const config = databaseConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(3306);
    expect(config.username).toBe('root');
    expect(config.password).toBe('root');
    expect(config.database).toBe('test');
  });

  it('loads .env correctly', () => {
    const testHost = 'testHost';
    const testPort = 1234;

    process.env.DB_HOST = testHost;
    process.env.DB_PORT = testPort.toString();

    const config = databaseConfig();

    expect(config.host).toBe(testHost);
    expect(config.port).toBe(testPort);
    expect(config.username).toBe('root');
    expect(config.password).toBe('root');
    expect(config.database).toBe('test');
  });
});

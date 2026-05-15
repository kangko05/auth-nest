import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { databaseProviders } from './database.providers';

jest.mock('typeorm', () => {
  const mockDataSource = {
    initialize: jest.fn().mockResolvedValue({ isInitialized: true }),
  };
  return { DataSource: jest.fn(() => mockDataSource) };
});

const baseConfig: Record<string, unknown> = {
  'database.host': 'test-host',
  'database.port': 3306,
  'database.username': 'test-user',
  'database.password': 'test-pass',
  'database.database': 'test-db',
};

const createModule = (nodeEnv = 'test') => {
  const mockConfigService = {
    get: jest.fn((key: string) =>
      key === 'NODE_ENV' ? nodeEnv : baseConfig[key],
    ),
  };

  return Test.createTestingModule({
    providers: [
      ...databaseProviders,
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();
};

describe('databaseProviders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ConfigService 값을 DataSource에 올바르게 전달', async () => {
    await createModule();

    expect(DataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'test-host',
        port: 3306,
        username: 'test-user',
        password: 'test-pass',
        database: 'test-db',
      }),
    );
  });

  it('DATA_SOURCE가 초기화된 DataSource 반환', async () => {
    const module = await createModule();

    const dataSource = module.get('DATA_SOURCE');

    expect(dataSource.isInitialized).toBe(true);
  });

  it('production 환경에서 synchronize false', async () => {
    await createModule('production');

    expect(DataSource).toHaveBeenCalledWith(
      expect.objectContaining({ synchronize: false }),
    );
  });

  it('production 외 환경에서 synchronize true', async () => {
    await createModule('development');

    expect(DataSource).toHaveBeenCalledWith(
      expect.objectContaining({ synchronize: true }),
    );
  });
});

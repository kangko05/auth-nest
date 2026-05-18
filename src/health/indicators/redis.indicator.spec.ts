import { Test } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.indicator';
import { REDIS_CLIENT } from '../../redis/constants';

const upResult = { redis: { status: 'up' } };
const downResult = { redis: { status: 'down' } };

const mockIndicator = {
  up: jest.fn().mockReturnValue(upResult),
  down: jest.fn().mockReturnValue(downResult),
};

const mockHealthIndicatorService = {
  check: jest.fn().mockReturnValue(mockIndicator),
};

const mockRedisClient = {
  ping: jest.fn(),
};

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        { provide: HealthIndicatorService, useValue: mockHealthIndicatorService },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    indicator = module.get(RedisHealthIndicator);
  });

  afterEach(() => jest.clearAllMocks());

  it('ping 성공 시 up 반환', async () => {
    mockRedisClient.ping.mockResolvedValue('PONG');

    const result = await indicator.pingCheck('redis');

    expect(result).toBe(upResult);
  });

  it('ping 실패 시 down 반환', async () => {
    mockRedisClient.ping.mockRejectedValue(new Error('connection refused'));

    const result = await indicator.pingCheck('redis');

    expect(result).toBe(downResult);
    expect(mockIndicator.down).toHaveBeenCalledWith({ message: 'connection refused' });
  });
});

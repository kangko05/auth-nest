import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { TypeOrmHealthIndicator } from './indicators/typeorm.indicator';

const mockHealthCheckService = {
  check: jest.fn(),
};

const mockTypeOrmIndicator = {
  pingCheck: jest.fn(),
};

const mockRedisIndicator = {
  pingCheck: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockTypeOrmIndicator },
        { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('live', () => {
    it('{ status: "ok" } 반환', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
    });
  });

  describe('ready', () => {
    it('health.check 호출', async () => {
      mockHealthCheckService.check.mockResolvedValue({ status: 'ok' });

      await controller.ready();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
      ]);
    });
  });
});

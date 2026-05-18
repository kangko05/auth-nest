import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { HealthIndicatorService } from '@nestjs/terminus';
import { REDIS_CLIENT } from '../../redis/constants';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async pingCheck(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.redisClient.ping();
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}

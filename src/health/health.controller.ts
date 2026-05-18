import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { TypeOrmHealthIndicator } from './indicators/typeorm.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeOrm: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.typeOrm.pingCheck('typeOrm'),
      () => this.redis.pingCheck('redis'),
    ]);
  }

  @Get('live')
  live() {
    return { status: 'ok' };
  }
}

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { RedisHealthIndicator } from './indicators/redis.indicator';
import { TypeOrmHealthIndicator } from './indicators/typeorm.indicator';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [TerminusModule, RedisModule, DatabaseModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, TypeOrmHealthIndicator],
})
export class HealthModule {}

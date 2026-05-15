import { Module } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './constants';

@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown() {
    const redis = this.moduleRef.get<Redis>(REDIS_CLIENT);
    if (redis) redis.disconnect();
  }
}

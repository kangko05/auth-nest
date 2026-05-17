import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AccountService } from './account.service';

@Module({
  imports: [RedisModule],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}

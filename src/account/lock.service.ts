import { Redis } from 'ioredis';
import { User } from '../users/entities/user.entity';
import { type LoggerService } from '@nestjs/common';

export class LockService {
  private readonly accFailKey = 'login:fail:'; // + user.id
  private readonly accLockKey = 'login:lock:'; // + user.id
  private readonly accFailLimit = 5;
  private readonly redisClient: Redis;
  private readonly logger: LoggerService;

  constructor(redisClient: Redis, logger: LoggerService) {
    this.redisClient = redisClient;
    this.logger = logger;
  }

  async isAccountLocked(user: User): Promise<boolean> {
    return (await this.redisClient.get(`${this.accLockKey}${user.id}`)) != null;
  }

  async incrementAccFailCount(user: User) {
    const accFailKey = `${this.accFailKey}${user.id}`;

    const newCnt = await this.redisClient.incr(accFailKey);

    if (newCnt == 1) await this.redisClient.expire(accFailKey, 600); // 10m

    if (newCnt >= this.accFailLimit) {
      await this.redisClient.set(
        `${this.accLockKey}${user.id}`,
        '1',
        'EX',
        1800,
      ); // 30m

      this.logger.warn(`account locked: ${user.id}`);
    }
  }

  async resetAccFailCount(user: User) {
    await Promise.all([
      this.redisClient.del(`${this.accFailKey}${user.id}`),
      this.redisClient.del(`${this.accLockKey}${user.id}`),
    ]);
  }
}

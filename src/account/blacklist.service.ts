import { Redis } from 'ioredis';

export class BlacklistService {
  private readonly blackListKey = 'blacklist';
  private readonly redisClient: Redis;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
  }

  async blacklistToken(tokenString: string, remainingMs: number) {
    await this.redisClient.set(
      `${this.blackListKey}:${tokenString}`,
      '1',
      'PX',
      remainingMs,
    );
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return (
      (await this.redisClient.get(`${this.blackListKey}:${token}`)) != null
    );
  }
}

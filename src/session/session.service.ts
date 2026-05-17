import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/constants';
import Redis from 'ioredis';
import { User } from '../users/entities/user.entity';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';

export interface Session {
  userId: string;
  refreshToken: string;
  userAgent: string;
  ip: string;
  createdAt: number;
}

@Injectable()
export class SessionService {
  private readonly blackListKey = 'blacklist';
  private readonly accFailKey = 'login:fail:'; // + user.id
  private readonly accLockKey = 'login:lock:'; // + user.id
  private readonly accFailLimit = 5;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async createSession(
    user: User,
    userAgent: string,
    refreshToken: string,
    userIp: string,
  ) {
    const sessionId = this.getSessionId(user.id, userAgent);

    await this.redisClient.set(
      sessionId,
      JSON.stringify({
        userId: user.id,
        refreshToken: refreshToken,
        userAgent: userAgent,
        ip: userIp,
        createdAt: Date.now(),
      }),
      'PX',
      ms(
        this.configService.get<string>(
          'jwt.refreshExpiresIn',
        ) as ms.StringValue,
      ),
    );
  }

  async findSession(user: User, userAgent: string): Promise<Session | null> {
    const sessionId = this.getSessionId(user.id, userAgent);
    const sessionStr = await this.redisClient.get(sessionId);

    if (!sessionStr) return null;

    return JSON.parse(sessionStr);
  }

  async deleteSession(user: User, userAgent: string) {
    const sessionId = this.getSessionId(user.id, userAgent);
    await this.redisClient.del(sessionId);
  }

  async deleteAllUserSessions(user: User) {
    const stream = this.redisClient.scanStream({ match: `${user.id}:*` });
    const keys: string[] = [];

    for await (const batch of stream) {
      keys.push(...batch);
    }

    if (keys.length > 0) await this.redisClient.del(...keys);
  }

  private getSessionId(userId: string, userAgent: string): string {
    const hashKey = `${userId}:${userAgent}`;
    const sessionIdPart = createHash('sha256').update(hashKey).digest('hex');
    return `${userId}:${sessionIdPart}`;
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
    }
  }

  async resetAccFailCount(user: User) {
    await Promise.all([
      this.redisClient.del(`${this.accFailKey}${user.id}`),
      this.redisClient.del(`${this.accLockKey}${user.id}`),
    ]);
  }
}

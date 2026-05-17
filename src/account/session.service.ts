import Redis from 'ioredis';
import { User } from '../users/entities/user.entity';
import { createHash } from 'crypto';
import ms from 'ms';

export interface Session {
  userId: string;
  refreshToken: string;
  userAgent: string;
  ip: string;
  createdAt: number;
}

export class SessionService {
  private readonly redisClient: Redis;
  private readonly refreshExpiresIn: number;

  constructor(redisClient: Redis, refreshExpiresIn: string) {
    this.redisClient = redisClient;
    this.refreshExpiresIn = ms(refreshExpiresIn as ms.StringValue);
  }

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
      this.refreshExpiresIn,
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
}

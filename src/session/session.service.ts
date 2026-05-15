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

  private getSessionId(userId: string, userAgent: string): string {
    const hashKey = `${userId}:${userAgent}`;
    const sessionIdPart = createHash('sha256').update(hashKey).digest('hex');
    return `${userId}:${sessionIdPart}`;
  }
}

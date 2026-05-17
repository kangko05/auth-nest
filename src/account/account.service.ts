import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/constants';
import { SessionService, Session } from './session.service';
import { BlacklistService } from './blacklist.service';
import { LockService } from './lock.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AccountService {
  private readonly sessionService: SessionService;
  private readonly blackListService: BlacklistService;
  private readonly lockService: LockService;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {
    this.sessionService = new SessionService(
      this.redisClient,
      this.configService.get('jwt.refreshExpiresIn')!, // TODO: check if this was validated in configservice
    );

    this.blackListService = new BlacklistService(this.redisClient);
    this.lockService = new LockService(this.redisClient);
  }

  // session services ==============================
  async createSession(
    user: User,
    userAgent: string,
    refreshToken: string,
    userIp: string,
  ) {
    await this.sessionService.createSession(
      user,
      userAgent,
      refreshToken,
      userIp,
    );
  }

  async findSession(user: User, userAgent: string): Promise<Session | null> {
    return this.sessionService.findSession(user, userAgent);
  }

  async deleteSession(user: User, userAgent: string) {
    await this.sessionService.deleteSession(user, userAgent);
  }

  async deleteAllUserSessions(user: User) {
    await this.sessionService.deleteAllUserSessions(user);
  }

  // blacklist services ==============================
  async blacklistToken(tokenString: string, remainingMs: number) {
    await this.blackListService.blacklistToken(tokenString, remainingMs);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return this.blackListService.isBlacklisted(token);
  }

  // account lock services ==============================

  async isAccountLocked(user: User): Promise<boolean> {
    return this.lockService.isAccountLocked(user);
  }

  async incrementAccFailCount(user: User) {
    await this.lockService.incrementAccFailCount(user);
  }

  async resetAccFailCount(user: User) {
    await this.lockService.resetAccFailCount(user);
  }
}

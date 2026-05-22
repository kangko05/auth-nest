import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  type LoggerService,
} from '@nestjs/common';
import { randomUUID, randomBytes } from 'crypto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { UserCreatedDto } from '../users/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { AccountService } from '../account/account.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppException, ErrorCode } from '../common/exception.filter';
import { MailService } from '../mail/mail.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge, Counter } from 'prom-client';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly accountService: AccountService,
    private readonly mailService: MailService,

    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,

    @InjectMetric('auth_login_total') private loginCounter: Counter<string>,
    @InjectMetric('auth_register_total')
    private registerCounter: Counter<string>,
    @InjectMetric('auth_active_sessions_total')
    private activeSessions: Gauge<string>,
  ) {}

  async register(registerDto: CreateUserDto): Promise<UserCreatedDto> {
    const foundUser = await this.userService.findByEmail(registerDto.email);

    if (foundUser) {
      this.registerCounter.inc({ status: 'duplicate' });
      throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const createdUser = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    this.registerCounter.inc({ status: 'success' });

    return { email: createdUser.email, createdAt: createdUser.createdAt };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const foundUser = await this.userService.findByEmail(email);

    if (foundUser) {
      const accountLocked =
        await this.accountService.isAccountLocked(foundUser);

      if (accountLocked) {
        this.loginCounter.inc({ status: 'locked' });
        this.logger.warn(`login attempt on locked account: ${email}`);
        return null;
      }

      if (foundUser.isBanned) {
        this.loginCounter.inc({ status: 'banned' });
        this.logger.warn(`login detected from banned user: ${email}`);

        return null;
      }

      const passwordMatched = await bcrypt.compare(
        password,
        foundUser.password,
      );

      if (!passwordMatched) {
        await this.accountService.incrementAccFailCount(foundUser);
        this.loginCounter.inc({ status: 'failed' });
        this.logger.warn(`login failed: ${email}`);

        return null;
      }

      await this.accountService.resetAccFailCount(foundUser);
    } else {
      this.loginCounter.inc({ status: 'failed' });
    }

    return foundUser;
  }

  async login(
    user: User,
    userIp?: string,
    userAgent?: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    if (!userAgent || !userIp) {
      this.loginCounter.inc({ status: 'failed' });
      throw new UnauthorizedException();
    }

    const tokenPair = await this.issueTokenPair(user);

    await this.accountService.createSession(
      user,
      userAgent,
      tokenPair.refresh_token,
      userIp,
    );

    this.activeSessions.inc();
    this.loginCounter.inc({ status: 'success' });
    this.logger.log(`user logged in: ${user.id}`);

    return tokenPair;
  }

  async refresh(
    user: User,
    refreshToken: string | null,
    userAgent?: string,
    userIp?: string,
  ) {
    if (!refreshToken) throw new BadRequestException();
    if (!userAgent || !userIp) throw new UnauthorizedException();

    const storedSession = await this.accountService.findSession(
      user,
      userAgent,
    );

    if (!storedSession) {
      this.logger.warn(`session not found: ${user.id}`);
      throw new AppException(ErrorCode.SESSION_NOT_FOUND);
    }
    if (storedSession.refreshToken !== refreshToken) {
      this.logger.warn(`refresh token mismatch: ${user.id}`);
      throw new AppException(ErrorCode.SESSION_NOT_FOUND);
    }
    if (storedSession.ip !== userIp) {
      this.logger.warn(`IP mismatch detected, session deleted: ${user.id}`);
      await this.accountService.deleteSession(user, userAgent);
      throw new AppException(ErrorCode.IP_MISMATCH);
    }

    const newTokenPair = await this.issueTokenPair(user);

    await this.accountService.createSession(
      user,
      userAgent,
      newTokenPair.refresh_token,
      userIp,
    );

    this.logger.log(`token refreshed: ${user.id}`);

    return newTokenPair;
  }

  async logout(user: User, accessToken?: string, userAgent?: string) {
    if (!userAgent) {
      await this.accountService.deleteAllUserSessions(user);
      return;
    }

    try {
      if (accessToken) {
        const token = accessToken.split(' ')[1];
        const payload = this.jwtService.decode(token) as { exp: number };
        const remainingTime = payload.exp * 1000 - Date.now(); // ms

        await this.accountService.blacklistToken(token, remainingTime);
      }
    } catch (err) {
      this.logger.warn(`failed to decode access token: ${user.id}`);
    } finally {
      await this.accountService.deleteSession(user, userAgent);
      this.activeSessions.dec();
      this.logger.log(`user logged out: ${user.id}`);
    }
  }

  private async issueTokenPair(user: User): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const tokenPair = await Promise.all([
      this.jwtService.signAsync(
        { jti: randomUUID(), sub: user.id, role: user.role },
        {
          algorithm: 'HS256',
        },
      ),
      this.jwtService.signAsync(
        { jti: randomUUID(), sub: user.id, role: user.role },
        {
          secret: this.configService.get('jwt.refreshSecret'),
          expiresIn: this.configService.get('jwt.refreshExpiresIn'),
          algorithm: 'HS256',
        },
      ),
    ]);

    return { access_token: tokenPair[0], refresh_token: tokenPair[1] };
  }

  async unlockUserAccount(adminId: string, userId: string) {
    const foundUser = await this.userService.findByUserId(userId);

    if (!foundUser) throw new AppException(ErrorCode.USER_NOT_FOUND);

    await this.accountService.resetAccFailCount(foundUser);

    this.logger.log(
      `user account unlocked by admin ${adminId}: target ${userId}`,
    );
  }

  async updateUserBanStatus(
    adminId: string,
    userId: string,
    isBanned: boolean,
  ) {
    const affected = await this.userService.updateUserBanStatus(
      userId,
      isBanned,
    );

    if (affected === 0) throw new AppException(ErrorCode.USER_NOT_FOUND);

    if (isBanned) {
      this.logger.warn(`user banned by admin ${adminId}: target ${userId}`);
    } else {
      this.logger.log(`user unbanned by admin ${adminId}: target ${userId}`);
    }

    return affected;
  }

  async resetPassword(email: string) {
    const foundUser = await this.userService.findByEmail(email);

    if (!foundUser) return;

    const token = randomBytes(32).toString('hex');

    await this.accountService.saveResetPasswordToken(email, token);
    await this.mailService.sendPasswordResetEmail(email, token);
  }

  async confirmResetPassword(token: string, newPassword: string) {
    if (token.length !== 64) throw new AppException(ErrorCode.INVALID_TOKEN);

    const email = await this.accountService.getResetPasswordToken(token);

    if (!email) {
      throw new AppException(ErrorCode.INVALID_TOKEN);
    }

    const foundUser = await this.userService.findByEmail(email);

    if (!foundUser) {
      throw new AppException(ErrorCode.USER_NOT_FOUND);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const affected = await this.userService.updateUserPassword(
      foundUser.id,
      hashedPassword,
    );

    if (affected === 0) {
      throw new AppException(ErrorCode.USER_NOT_FOUND);
    }

    await this.accountService.deleteResetPasswordToken(token);
  }
}

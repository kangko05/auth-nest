import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  type LoggerService,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { UserCreatedDto } from '../users/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { Session } from '../account/session.service';
import { AccountService } from '../account/account.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppException, ErrorCode } from '../common/exception.filter';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly accountService: AccountService,

    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async register(registerDto: CreateUserDto): Promise<UserCreatedDto> {
    const foundUser = await this.userService.findByEmail(registerDto.email);

    if (foundUser) {
      throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const createdUser = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    return { email: createdUser.email, createdAt: createdUser.createdAt };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const foundUser = await this.userService.findByEmail(email);

    if (foundUser) {
      const [accountLocked, passwordMatched] = await Promise.all([
        this.accountService.isAccountLocked(foundUser),
        bcrypt.compare(password, foundUser.password),
      ]);

      if (accountLocked) {
        this.logger.warn(`login attempt on locked account: ${email}`);
        return null;
      }

      if (!passwordMatched) {
        await this.accountService.incrementAccFailCount(foundUser);

        this.logger.warn(`login failed: ${email}`);

        return null;
      }

      await this.accountService.resetAccFailCount(foundUser);
    }

    return foundUser;
  }

  async login(
    user: User,
    userIp?: string,
    userAgent?: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    if (!userAgent || !userIp) throw new UnauthorizedException();

    const tokenPair = await this.issueTokenPair(user);

    await this.accountService.createSession(
      user,
      userAgent,
      tokenPair.refresh_token,
      userIp,
    );

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

    if (!this.isSessionValid(storedSession, refreshToken, userIp)) {
      await this.accountService.deleteSession(user, userAgent);

      this.logger.warn(`IP mismatch detected, session deleted: ${user.id}`);

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

  private isSessionValid(
    storedSession: Session | null,
    refreshToken: string,
    userIp: string,
  ) {
    if (storedSession == null) return false;

    const refreshTokenMatch = refreshToken === storedSession.refreshToken;
    const requestIpMatch = userIp === storedSession.ip;

    return refreshTokenMatch && requestIpMatch;
  }

  async logout(user: User, accessToken?: string, userAgent?: string) {
    if (!userAgent) {
      await this.accountService.deleteAllUserSessions(user);
      return;
    }

    if (accessToken) {
      const token = accessToken.split(' ')[1];
      const payload = this.jwtService.decode(token) as { exp: number };
      const remainingTime = payload.exp * 1000 - Date.now(); // ms

      await this.accountService.blacklistToken(token, remainingTime);
    }

    await this.accountService.deleteSession(user, userAgent);

    this.logger.log(`user logged out: ${user.id}`);
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
}

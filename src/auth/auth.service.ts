import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { UserCreatedDto } from '../users/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session/session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  async register(registerDto: CreateUserDto): Promise<UserCreatedDto> {
    const foundUser = await this.userService.findByEmail(registerDto.email);

    if (foundUser) {
      throw new ConflictException('이미 사용 중인 이메일 입니다.');
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

    if (!foundUser || !(await bcrypt.compare(password, foundUser.password)))
      return null;

    return foundUser;
  }

  async login(
    user: User,
    userIp?: string,
    userAgent?: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    if (!userAgent || !userIp) throw new UnauthorizedException();

    const tokenPair = await this.issueTokenPair(user);

    await this.sessionService.createSession(
      user,
      userAgent,
      tokenPair.refresh_token,
      userIp,
    );

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

    const storedSession = await this.sessionService.findSession(
      user,
      userAgent,
    );

    if (!storedSession || refreshToken !== storedSession.refreshToken)
      throw new UnauthorizedException();

    const newTokenPair = await this.issueTokenPair(user);

    await this.sessionService.createSession(
      user,
      userAgent,
      newTokenPair.refresh_token,
      userIp,
    );

    return newTokenPair;
  }

  async logout(user: User, userAgent?: string) {
    if (!userAgent) throw new UnauthorizedException();

    await this.sessionService.deleteSession(user, userAgent);
  }

  private async issueTokenPair(user: User): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const tokenPair = await Promise.all([
      this.jwtService.signAsync({ sub: user.id }),
      this.jwtService.signAsync(
        { sub: user.id },
        {
          secret: this.configService.get('jwt.refreshSecret'),
          expiresIn: this.configService.get('jwt.refreshExpiresIn'),
        },
      ),
    ]);

    return { access_token: tokenPair[0], refresh_token: tokenPair[1] };
  }
}

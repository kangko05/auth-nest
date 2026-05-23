import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { AppException, ErrorCode } from '../../common/exception.filter';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @Inject(UsersService) private readonly userService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret') as string,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub: string; role: UserRole; iat: number }) {
    const user = await this.userService.findByUserId(payload.sub);

    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);

    const tokenValidAfter = user.tokenValidAfter;

    if (tokenValidAfter && payload.iat < tokenValidAfter.getTime() / 1000)
      throw new UnauthorizedException();

    return { id: payload.sub, role: payload.role };
  }
}

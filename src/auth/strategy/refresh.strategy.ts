import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppException, ErrorCode } from '../../common/exception.filter';
import { UsersService } from '../../users/users.service';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private readonly configService: ConfigService, private readonly userService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.refresh_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.refreshSecret') as string,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.userService.findByUserId(payload.sub);

    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);
    if (user.isBanned) throw new AppException(ErrorCode.ACCOUNT_BANNED);

    return { id: payload.sub };
  }
}

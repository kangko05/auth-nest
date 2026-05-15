import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private readonly configService: ConfigService) {
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
    return { id: payload.sub };
  }
}

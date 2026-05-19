import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {
    super({
      clientID: configService.get('google.clientId') as string,
      clientSecret: configService.get('google.clientSecret') as string,
      callbackURL: configService.get('google.callbackUrl') as string,
      scope: ['email', 'profile'],
    });
  }

  validate(_at: string, _rt: string, profile: Profile): Promise<User> {
    const email = profile.emails?.[0].value;
    if (!email)
      throw new UnauthorizedException('이메일 정보를 가져올 수 없습니다.');

    const providerId = profile.id;

    return this.userService.createOrUpdateOauthUser({
      email,
      provider: 'google',
      providerId,
    });
  }
}

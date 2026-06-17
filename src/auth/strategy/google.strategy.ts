import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AppException, ErrorCode } from '../../common/exception.filter';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

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

  async validate(_at: string, _rt: string, profile: Profile): Promise<User> {
    const email = profile.emails?.[0].value;
    if (!email)
      throw new UnauthorizedException('이메일 정보를 가져올 수 없습니다.');

    const providerId = profile.id;

    const user = await this.userService.createOrUpdateOauthUser({
      email,
      provider: 'google',
      providerId,
    });

    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);
    if (user.isBanned) throw new AppException(ErrorCode.BANNED_USER);

    return user;
  }
}

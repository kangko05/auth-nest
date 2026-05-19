import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

import { UsersModule } from '../users/users.module';
import { AccountModule } from '../account/account.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategy/local.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import {
  GoogleAuthGuard,
  JwtAuthGuard,
  LocalAuthGuard,
  RefreshGuard,
} from './auth.guard';
import { RefreshStrategy } from './strategy/refresh.strategy';
import { GoogleStrategy } from './strategy/google.strategy';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: { expiresIn: configService.get('jwt.expiresIn') },
      }),
    }),
    UsersModule,
    PassportModule,
    AccountModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LocalAuthGuard,
    JwtAuthGuard,
    RefreshStrategy,
    RefreshGuard,
    GoogleAuthGuard,
    GoogleStrategy,
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}

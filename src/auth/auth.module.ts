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
import {
  makeCounterProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

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
    makeCounterProvider({
      name: 'auth_login_total',
      help: '로그인 시도 횟수',
      labelNames: ['status'],
    }),
    makeCounterProvider({
      name: 'auth_register_total',
      help: '회원가입 횟수',
      labelNames: ['status'],
    }),
    makeGaugeProvider({
      name: 'auth_active_sessions_total',
      help: '현재 활성 세션 수',
    }),
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}

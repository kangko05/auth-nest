import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ConfigService } from '@nestjs/config';
import {
  makeCounterProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { AccountModule } from '../account/account.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import {
  GoogleAuthGuard,
  JwtAuthGuard,
  LocalAuthGuard,
  RefreshGuard,
} from './auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './controllers/external.http.controller';
import { InternalHttpController } from './controllers/internal.http.controller';
import { GoogleStrategy } from './strategy/google.strategy';
import { JwtStrategy } from './strategy/jwt.strategy';
import { LocalStrategy } from './strategy/local.strategy';
import { RefreshStrategy } from './strategy/refresh.strategy';

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
  controllers: [AuthController, InternalHttpController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    LocalAuthGuard,
    JwtAuthGuard,
    RefreshStrategy,
    RefreshGuard,
    GoogleAuthGuard,
    {
      provide: GoogleStrategy,
      inject: [ConfigService, UsersService],
      useFactory: (configService: ConfigService, userService: UsersService) => {
        return configService.get("google.enabled") ? new GoogleStrategy(configService, userService) : null;
      },
    },

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
export class AuthModule { }

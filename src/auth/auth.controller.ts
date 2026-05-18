import {
  Delete,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  Put,
  Param,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import {
  JwtAuthGuard,
  LocalAuthGuard,
  RefreshGuard,
  RolesGuard,
} from './auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { Throttle } from '@nestjs/throttler';
import { Roles } from './decorators/roles.decorator';

@Controller('auth')
export class AuthController {
  private readonly refreshTokenKey = 'refresh_token';

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: CreateUserDto) {
    return this.authService.register(registerDto);
  }

  // ==========================================================================
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const { access_token, refresh_token } = await this.authService.login(
      user,
      req.ip,
      userAgent,
    );

    res.cookie(this.refreshTokenKey, refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProdEnv(),
    });

    return { access_token };
  }

  private isProdEnv(): boolean {
    const nodeEnv = process.env.NODE_ENV;
    return nodeEnv === 'prod' || nodeEnv === 'production';
  }

  @Throttle({ default: { limit: 30 } })
  @UseGuards(RefreshGuard)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: User,
  ) {
    const userAgent = req.headers['user-agent'];
    const { access_token, refresh_token } = await this.authService.refresh(
      user,
      req.cookies.refresh_token,
      userAgent,
      req.ip,
    );

    res.cookie(this.refreshTokenKey, refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProdEnv(),
    });

    return { access_token };
  }

  @Throttle({ default: { limit: 10 } })
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(this.refreshTokenKey);
    await this.authService.logout(
      user,
      req.headers.authorization,
      req.headers['user-agent'],
    );
  }

  // admin routes ==============================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/unlock/:userId')
  async unlockUserAccount(
    @Param('userId') userId: string,
    @CurrentUser() admin: User,
  ) {
    await this.authService.unlockUserAccount(admin.id, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/ban/:userId')
  async banUser(@Param('userId') userId: string, @CurrentUser() admin: User) {
    const affected = await this.authService.updateUserBanStatus(
      admin.id,
      userId,
      true,
    );
    return { affected };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('/ban/:userId')
  async unbanUser(@Param('userId') userId: string, @CurrentUser() admin: User) {
    const affected = await this.authService.updateUserBanStatus(
      admin.id,
      userId,
      false,
    );
    return { affected };
  }
}

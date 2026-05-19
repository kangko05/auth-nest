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
  Get,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import {
  GoogleAuthGuard,
  JwtAuthGuard,
  LocalAuthGuard,
  RefreshGuard,
  RolesGuard,
} from './auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { Throttle } from '@nestjs/throttler';
import { Roles } from './decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LoginUserDto } from './dto/login-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly refreshTokenKey = 'refresh_token';

  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: '회원가입' })
  @ApiResponse({ status: 201, description: '가입 성공' })
  @ApiResponse({ status: 409, description: '이메일 중복' })
  @Post('register')
  register(@Body() registerDto: CreateUserDto) {
    return this.authService.register(registerDto);
  }

  // ==========================================================================
  @ApiOperation({ summary: '로그인' })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({ status: 200, description: 'access_token 반환' })
  @ApiResponse({ status: 401, description: '이메일 또는 비밀번호 불일치' })
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

  @ApiBearerAuth()
  @ApiOperation({ summary: '로그아웃' })
  @ApiResponse({ status: 204 })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: '계정 일시 잠금 해제' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('/unlock/:userId')
  async unlockUserAccount(
    @Param('userId') userId: string,
    @CurrentUser() admin: User,
  ) {
    await this.authService.unlockUserAccount(admin.id, userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: '계정 영구 잠금' })
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

  @ApiBearerAuth()
  @ApiOperation({ summary: '계정 영구 잠금 해제' })
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

  // oauth ====================================================================
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin() {}

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(
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
}

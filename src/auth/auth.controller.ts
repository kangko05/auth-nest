import {
  Delete,
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard, LocalAuthGuard, RefreshGuard } from './auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  private readonly refreshTokenKey = 'refresh_token';

  constructor(private readonly authService: AuthService) {}

  // TODO: move this api to users module
  @Post('register')
  register(@Body() registerDto: CreateUserDto) {
    return this.authService.register(registerDto);
  }

  // ==========================================================================
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token } = await this.authService.login(user);

    res.cookie(this.refreshTokenKey, refresh_token, {
      httpOnly: true,
      secure: true,
    });

    return { access_token };
  }

  @UseGuards(RefreshGuard)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: User,
  ) {
    const { access_token, refresh_token } = await this.authService.refresh(
      user,
      req.cookies.refresh_token,
    );

    res.cookie(this.refreshTokenKey, refresh_token, {
      httpOnly: true,
      secure: true,
    });

    return { access_token };
  }

  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(this.refreshTokenKey);
    await this.authService.logout(user);
  }
}

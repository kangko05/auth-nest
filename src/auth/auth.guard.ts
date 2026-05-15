import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SessionService } from '../session/session.service';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers['authorization']?.split(' ')[1];

    if (token && (await this.sessionService.isBlacklisted(token)))
      throw new UnauthorizedException();

    return true;
  }
}

@Injectable()
export class RefreshGuard extends AuthGuard('refresh') {}

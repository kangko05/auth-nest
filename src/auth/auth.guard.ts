import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { AccountService } from '../account/account.service';
import { AppException, ErrorCode } from '../common/exception.filter';
import { UserRole } from '../users/entities/user.entity';
import { ROLES_KEY } from './decorators/roles.decorator';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') { }

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly accountService: AccountService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context);

        const req = context.switchToHttp().getRequest<Request>();
        const token = req.headers['authorization']?.split(' ')[1];

        if (token && (await this.accountService.isBlacklisted(token)))
            throw new AppException(ErrorCode.TOKEN_BLACKLISTED);

        return true;
    }
}

@Injectable()
export class RefreshGuard extends AuthGuard('refresh') { }

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles) return true;

        const { user } = context.switchToHttp().getRequest();

        return requiredRoles.includes(user.role);
    }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    constructor(private readonly configService: ConfigService) {
        super();
    }


    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        if (!this.configService.get("google.enabled")) {
            throw new AppException(ErrorCode.FEATURE_NOT_CONFIGURED)
        }

        return super.canActivate(context);
    }
}

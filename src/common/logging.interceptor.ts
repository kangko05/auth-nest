import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  type LoggerService,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) { }

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const { method, url } = context.switchToHttp().getRequest();
    const start = Date.now();

    const succ = () => {
      const res = context.switchToHttp().getResponse();
      this.logger.log(
        `${method} ${url} ${res.statusCode} ${Date.now() - start}ms`,
      );
    };

    const error = (err) => {
      this.logger.warn(`${method} ${url} ${err.status ?? 500} ${Date.now() - start}ms`)
    };

    return next.handle().pipe(
      tap({ next: succ, error }),
    );
  }
}

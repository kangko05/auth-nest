import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

export const ErrorCode = {
  FEATURE_NOT_CONFIGURED: {
    code: 'FEATURE_NOT_CONFIGURED',
    status: 503,
    message: '현재 설정되지 않은 기능입니다.',
  },
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    status: 401,
    message: '계정이 잠겨 있습니다.',
  },
  ACCOUNT_BANNED: {
    code: 'ACCOUNT_BANNED',
    status: 403,
    message: '영구 정지된 계정입니다.',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    status: 401,
    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
  },
  TOKEN_BLACKLISTED: {
    code: 'TOKEN_BLACKLISTED',
    status: 401,
    message: '유효하지 않은 토큰입니다.',
  },
  SESSION_NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    status: 401,
    message: '세션이 존재하지 않습니다.',
  },
  IP_MISMATCH: {
    code: 'IP_MISMATCH',
    status: 401,
    message: '비정상적인 접근이 감지되었습니다.',
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    status: 404,
    message: '존재하지 않는 유저입니다.',
  },
  EMAIL_ALREADY_EXISTS: {
    code: 'EMAIL_ALREADY_EXISTS',
    status: 409,
    message: '이미 사용 중인 이메일입니다.',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    status: 400,
    message: '유효하지 않거나 만료된 토큰입니다.',
  },
} as const;

type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorResponse {
  statusCode: number;
  errorCode?: string;
  message: string;
  timestamp: string;
  path: string;
}

export class AppException extends HttpException {
  readonly errorCode: string;

  constructor(errorCode: ErrorCodeValue) {
    super(errorCode.message, errorCode.status);
    this.errorCode = errorCode.code;
  }
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const res = exception.getResponse();
    const errorMessage = typeof res === 'string' ? res : (res as any).message;

    const body: ErrorResponse = {
      statusCode: status,
      errorCode:
        exception instanceof AppException ? exception.errorCode : undefined,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }
}

import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountService } from '../account/account.service';
import * as bcrypt from 'bcrypt';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockUserService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  findByUserId: jest.fn(),
  updateUserBanStatus: jest.fn(),
};

const mockJWTService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
  decode: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'jwt.refreshExpiresIn': '7d',
      'jwt.refreshSecret': 'test-refresh-secret',
    };
    return config[key];
  }),
};

const mockAccountService = {
  createSession: jest.fn(),
  findSession: jest.fn(),
  deleteSession: jest.fn(),
  deleteAllUserSessions: jest.fn(),
  blacklistToken: jest.fn(),
  isBlacklisted: jest.fn(),
  isAccountLocked: jest.fn(),
  incrementAccFailCount: jest.fn(),
  resetAccFailCount: jest.fn(),
};

const user = {
  id: 'uuid-1',
  email: 'test@test.com',
  password: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const userDto = { email: 'test@test.com', password: 'Test1234!' };
const createdUser = {
  email: userDto.email,
  createdAt: new Date(),
  password: 'hashed',
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJWTService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('정상 가입', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(createdUser);

      await authService.register(userDto);

      expect(mockUserService.create).toHaveBeenCalled();
    });

    it('중복 아이디', async () => {
      mockUserService.findByEmail.mockResolvedValue(createdUser);

      await expect(authService.register(userDto)).rejects.toThrow(ConflictException);
    });

    it('비밀번호 해시되어 저장', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(createdUser);

      await authService.register(userDto);

      const calledWith = mockUserService.create.mock.calls[0][0];
      expect(calledWith.password).not.toBe(userDto.password);
    });

    it('응답에 password 미포함', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(createdUser);

      const result = await authService.register(userDto);

      expect(result).not.toHaveProperty('password');
    });

    it('응답에 email, createdAt 포함', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(createdUser);

      const result = await authService.register(userDto);

      expect(result).toHaveProperty('email', userDto.email);
      expect(result).toHaveProperty('createdAt');
    });
  });

  describe('login', () => {
    beforeEach(() => {
      mockJWTService.signAsync.mockResolvedValue('mock.jwt.token');
      mockAccountService.createSession.mockResolvedValue(undefined);
    });

    it('access_token, refresh_token 반환', async () => {
      const result = await authService.login(user as any, '127.0.0.1', 'Mozilla/5.0');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('signAsync 두 번 호출 (access, refresh)', async () => {
      await authService.login(user as any, '127.0.0.1', 'Mozilla/5.0');

      expect(mockJWTService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('세션 생성 호출', async () => {
      await authService.login(user as any, '127.0.0.1', 'Mozilla/5.0');

      expect(mockAccountService.createSession).toHaveBeenCalledWith(
        user,
        'Mozilla/5.0',
        expect.any(String),
        '127.0.0.1',
      );
    });

    it('UA 없으면 UnauthorizedException', async () => {
      await expect(
        authService.login(user as any, '127.0.0.1', undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('IP 없으면 UnauthorizedException', async () => {
      await expect(
        authService.login(user as any, undefined, 'Mozilla/5.0'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const storedToken = 'stored.refresh.token';

    beforeEach(() => {
      mockJWTService.signAsync.mockResolvedValue('new.jwt.token');
      mockAccountService.createSession.mockResolvedValue(undefined);
    });

    it('정상 갱신 - 새 토큰 반환', async () => {
      mockAccountService.findSession.mockResolvedValue({ refreshToken: storedToken, ip: '127.0.0.1' });

      const result = await authService.refresh(user as any, storedToken, 'Mozilla/5.0', '127.0.0.1');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('세션 없으면 UnauthorizedException', async () => {
      mockAccountService.findSession.mockResolvedValue(null);

      await expect(
        authService.refresh(user as any, storedToken, 'Mozilla/5.0', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('토큰 불일치 시 UnauthorizedException', async () => {
      mockAccountService.findSession.mockResolvedValue({ refreshToken: 'different.token' });

      await expect(
        authService.refresh(user as any, storedToken, 'Mozilla/5.0', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refreshToken null이면 BadRequestException', async () => {
      await expect(
        authService.refresh(user as any, null, 'Mozilla/5.0', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('UA 없으면 UnauthorizedException', async () => {
      await expect(
        authService.refresh(user as any, storedToken, undefined, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('IP 불일치 시 UnauthorizedException + 세션 삭제', async () => {
      mockAccountService.findSession.mockResolvedValue({ refreshToken: storedToken, ip: '192.168.1.1' });

      await expect(
        authService.refresh(user as any, storedToken, 'Mozilla/5.0', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAccountService.deleteSession).toHaveBeenCalledWith(user, 'Mozilla/5.0');
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      mockAccountService.deleteSession.mockResolvedValue(undefined);
      mockAccountService.deleteAllUserSessions.mockResolvedValue(undefined);
      mockAccountService.blacklistToken.mockResolvedValue(undefined);
    });

    it('정상 로그아웃 - 세션 삭제 호출', async () => {
      await authService.logout(user as any, undefined, 'Mozilla/5.0');

      expect(mockAccountService.deleteSession).toHaveBeenCalledWith(user, 'Mozilla/5.0');
    });

    it('access token 있으면 블랙리스트 등록', async () => {
      const fakeToken = 'Bearer mock.access.token';
      mockJWTService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

      await authService.logout(user as any, fakeToken, 'Mozilla/5.0');

      expect(mockAccountService.blacklistToken).toHaveBeenCalled();
    });

    it('UA 없으면 전체 세션 삭제', async () => {
      await authService.logout(user as any, undefined, undefined);

      expect(mockAccountService.deleteAllUserSessions).toHaveBeenCalledWith(user);
    });
  });

  describe('validateUser', () => {
    beforeEach(() => {
      mockAccountService.isAccountLocked.mockResolvedValue(false);
      mockAccountService.incrementAccFailCount.mockResolvedValue(undefined);
      mockAccountService.resetAccFailCount.mockResolvedValue(undefined);
    });

    it('비밀번호 일치 시 유저 반환', async () => {
      const hashedPassword = await bcrypt.hash(userDto.password, 12);
      mockUserService.findByEmail.mockResolvedValue({ ...createdUser, password: hashedPassword });

      const result = await authService.validateUser(userDto.email, userDto.password);

      expect(result).not.toBeNull();
      expect(result?.email).toBe(userDto.email);
    });

    it('성공 시 실패 횟수 초기화', async () => {
      const hashedPassword = await bcrypt.hash(userDto.password, 12);
      mockUserService.findByEmail.mockResolvedValue({ ...createdUser, password: hashedPassword });

      await authService.validateUser(userDto.email, userDto.password);

      expect(mockAccountService.resetAccFailCount).toHaveBeenCalled();
    });

    it('비밀번호 불일치 시 null 반환', async () => {
      const hashedPassword = await bcrypt.hash('wrongpassword', 12);
      mockUserService.findByEmail.mockResolvedValue({ ...createdUser, password: hashedPassword });

      const result = await authService.validateUser(userDto.email, userDto.password);

      expect(result).toBeNull();
    });

    it('비밀번호 불일치 시 실패 횟수 증가', async () => {
      const hashedPassword = await bcrypt.hash('wrongpassword', 12);
      mockUserService.findByEmail.mockResolvedValue({ ...createdUser, password: hashedPassword });

      await authService.validateUser(userDto.email, userDto.password);

      expect(mockAccountService.incrementAccFailCount).toHaveBeenCalled();
    });

    it('계정 잠금 상태 시 null 반환', async () => {
      mockAccountService.isAccountLocked.mockResolvedValue(true);
      mockUserService.findByEmail.mockResolvedValue(createdUser);

      const result = await authService.validateUser(userDto.email, userDto.password);

      expect(result).toBeNull();
    });

    it('계정 잠금 상태 시 실패 횟수 증가 안 함', async () => {
      mockAccountService.isAccountLocked.mockResolvedValue(true);
      mockUserService.findByEmail.mockResolvedValue(createdUser);

      await authService.validateUser(userDto.email, userDto.password);

      expect(mockAccountService.incrementAccFailCount).not.toHaveBeenCalled();
    });

    it('유저 없을 시 null 반환', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser(userDto.email, userDto.password);

      expect(result).toBeNull();
    });
  });

  describe('unlockUserAccount', () => {
    it('유저 존재 시 잠금 해제', async () => {
      mockUserService.findByUserId.mockResolvedValue(user);
      mockAccountService.resetAccFailCount.mockResolvedValue(undefined);

      await authService.unlockUserAccount('admin-id', user.id);

      expect(mockAccountService.resetAccFailCount).toHaveBeenCalledWith(user);
    });

    it('유저 없으면 NotFoundException', async () => {
      mockUserService.findByUserId.mockResolvedValue(null);

      await expect(authService.unlockUserAccount('admin-id', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserBanStatus', () => {
    it('밴 처리 성공', async () => {
      mockUserService.updateUserBanStatus.mockResolvedValue(1);

      const result = await authService.updateUserBanStatus('admin-id', user.id, true);

      expect(mockUserService.updateUserBanStatus).toHaveBeenCalledWith(user.id, true);
      expect(result).toBe(1);
    });

    it('유저 없으면 NotFoundException', async () => {
      mockUserService.updateUserBanStatus.mockResolvedValue(0);

      await expect(authService.updateUserBanStatus('admin-id', 'non-existent', true)).rejects.toThrow(NotFoundException);
    });
  });
});

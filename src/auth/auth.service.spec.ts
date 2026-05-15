import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../redis/constants';
import * as bcrypt from 'bcrypt';

const mockUserService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJWTService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
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

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
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
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  const userDto = { email: 'test@test.com', password: 'Test1234!' };
  const createdUser = {
    email: userDto.email,
    createdAt: new Date(),
    password: 'hashed',
  };

  it('정상 가입', async () => {
    mockUserService.findByEmail.mockResolvedValue(null);
    mockUserService.create.mockResolvedValue(createdUser);

    await authService.register(userDto);

    expect(mockUserService.create).toHaveBeenCalled();
  });

  it('중복 아이디', async () => {
    mockUserService.findByEmail.mockResolvedValue(createdUser);

    await expect(authService.register(userDto)).rejects.toThrow(
      ConflictException,
    );
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

  describe('login', () => {
    const user = {
      id: 'uuid-1',
      email: 'test@test.com',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockJWTService.signAsync.mockResolvedValue('mock.jwt.token');
      mockRedisClient.set.mockResolvedValue('OK');
    });

    it('access_token, refresh_token 반환', async () => {
      const result = await authService.login(user as any);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('signAsync 두 번 호출 (access, refresh)', async () => {
      await authService.login(user as any);

      expect(mockJWTService.signAsync).toHaveBeenCalledTimes(2);
    });

    it('Redis에 refresh token 저장', async () => {
      await authService.login(user as any);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        'PX',
        expect.any(Number),
      );
    });
  });

  describe('refresh', () => {
    const user = {
      id: 'uuid-1',
      email: 'test@test.com',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const storedToken = 'stored.refresh.token';

    beforeEach(() => {
      mockJWTService.signAsync.mockResolvedValue('new.jwt.token');
      mockRedisClient.set.mockResolvedValue('OK');
    });

    it('정상 갱신 - 새 토큰 반환', async () => {
      mockRedisClient.get.mockResolvedValue(storedToken);

      const result = await authService.refresh(user as any, storedToken);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('Redis에 새 refresh token 저장', async () => {
      mockRedisClient.get.mockResolvedValue(storedToken);

      await authService.refresh(user as any, storedToken);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        'PX',
        expect.any(Number),
      );
    });

    it('Redis에 토큰 없으면 UnauthorizedException', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        authService.refresh(user as any, storedToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('토큰 불일치 시 UnauthorizedException', async () => {
      mockRedisClient.get.mockResolvedValue('different.token');

      await expect(
        authService.refresh(user as any, storedToken),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refreshToken null이면 BadRequestException', async () => {
      await expect(
        authService.refresh(user as any, null),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    const user = {
      id: 'uuid-1',
      email: 'test@test.com',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('Redis에서 refresh token 삭제', async () => {
      mockRedisClient.del = jest.fn().mockResolvedValue(1);

      await authService.logout(user as any);

      expect(mockRedisClient.del).toHaveBeenCalledWith(user.id);
    });
  });

  describe('validateUser', () => {
    it('비밀번호 일치 시 유저 반환', async () => {
      const hashedPassword = await bcrypt.hash(userDto.password, 12);
      mockUserService.findByEmail.mockResolvedValue({
        ...createdUser,
        password: hashedPassword,
      });

      const result = await authService.validateUser(
        userDto.email,
        userDto.password,
      );

      expect(result).not.toBeNull();
      expect(result?.email).toBe(userDto.email);
    });

    it('비밀번호 불일치 시 null 반환', async () => {
      const hashedPassword = await bcrypt.hash('wrongpassword', 12);
      mockUserService.findByEmail.mockResolvedValue({
        ...createdUser,
        password: hashedPassword,
      });

      const result = await authService.validateUser(
        userDto.email,
        userDto.password,
      );

      expect(result).toBeNull();
    });

    it('유저 없을 시 null 반환', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser(
        userDto.email,
        userDto.password,
      );

      expect(result).toBeNull();
    });
  });
});

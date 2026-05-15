import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

const mockUserService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJWTService = {
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJWTService },
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

    it('JWT access_token 반환', async () => {
      const result = await authService.login(user as any);

      expect(mockJWTService.signAsync).toHaveBeenCalledWith({ sub: user.id });
      expect(result).toHaveProperty('access_token', 'mock.jwt.token');
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

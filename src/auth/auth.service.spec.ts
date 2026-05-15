import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

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
});

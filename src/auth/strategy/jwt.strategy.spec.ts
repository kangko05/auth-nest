import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';
import { AppException } from '../../common/exception.filter';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'jwt.secret') return 'test-secret';
  }),
};

const mockUsersService = {
  findByUserId: jest.fn(),
};

const baseUser = {
  id: 'uuid-1',
  email: 'test@test.com',
  role: UserRole.USER,
  tokenValidAfter: null,
};

const basePayload = {
  sub: 'uuid-1',
  role: UserRole.USER,
  iat: Math.floor(Date.now() / 1000),
};

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    jwtStrategy = module.get(JwtStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  it('정상 토큰 — id, role 반환', async () => {
    mockUsersService.findByUserId.mockResolvedValue(baseUser);

    const result = await jwtStrategy.validate(basePayload);

    expect(result).toEqual({ id: basePayload.sub, role: basePayload.role });
  });

  it('tokenValidAfter null이면 통과', async () => {
    mockUsersService.findByUserId.mockResolvedValue({ ...baseUser, tokenValidAfter: null });

    await expect(jwtStrategy.validate(basePayload)).resolves.not.toThrow();
  });

  it('iat가 tokenValidAfter 이후면 통과', async () => {
    const past = new Date(Date.now() - 60 * 1000); // 1분 전
    mockUsersService.findByUserId.mockResolvedValue({ ...baseUser, tokenValidAfter: past });

    await expect(jwtStrategy.validate(basePayload)).resolves.not.toThrow();
  });

  it('iat가 tokenValidAfter 이전이면 UnauthorizedException', async () => {
    const future = new Date(Date.now() + 60 * 1000); // 1분 후
    mockUsersService.findByUserId.mockResolvedValue({ ...baseUser, tokenValidAfter: future });

    await expect(jwtStrategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
  });

  it('유저 없으면 AppException', async () => {
    mockUsersService.findByUserId.mockResolvedValue(null);

    await expect(jwtStrategy.validate(basePayload)).rejects.toThrow(AppException);
  });
});

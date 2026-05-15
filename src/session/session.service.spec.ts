import { Test } from '@nestjs/testing';
import { SessionService } from './session.service';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../redis/constants';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'jwt.refreshExpiresIn') return '7d';
    return undefined;
  }),
};

const user: User = {
  id: 'uuid-1',
  email: 'test@test.com',
  password: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const userAgent = 'Mozilla/5.0 (Test)';
const userIp = '127.0.0.1';
const refreshToken = 'refresh.token';

const getSessionId = (userId: string, ua: string) => {
  const hash = createHash('sha256').update(`${userId}:${ua}`).digest('hex');
  return `${userId}:${hash}`;
};

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    sessionService = module.get(SessionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createSession', () => {
    it('올바른 키로 Redis에 저장', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await sessionService.createSession(user, userAgent, refreshToken, userIp);

      const expectedKey = getSessionId(user.id, userAgent);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
        'PX',
        expect.any(Number),
      );
    });

    it('세션 데이터에 userId, refreshToken, userAgent, ip 포함', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await sessionService.createSession(user, userAgent, refreshToken, userIp);

      const storedValue = JSON.parse(mockRedisClient.set.mock.calls[0][1]);
      expect(storedValue).toMatchObject({
        userId: user.id,
        refreshToken,
        userAgent,
        ip: userIp,
      });
    });
  });

  describe('findSession', () => {
    it('세션 있으면 파싱해서 반환', async () => {
      const session = { userId: user.id, refreshToken, userAgent, ip: userIp, createdAt: Date.now() };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(session));

      const result = await sessionService.findSession(user, userAgent);

      const expectedKey = getSessionId(user.id, userAgent);
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
      expect(result).toMatchObject({ userId: user.id, refreshToken });
    });

    it('세션 없으면 null 반환', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await sessionService.findSession(user, userAgent);

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('올바른 키로 삭제 호출', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await sessionService.deleteSession(user, userAgent);

      const expectedKey = getSessionId(user.id, userAgent);
      expect(mockRedisClient.del).toHaveBeenCalledWith(expectedKey);
    });
  });
});

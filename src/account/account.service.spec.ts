import { Test } from '@nestjs/testing';
import { AccountService } from './account.service';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../redis/constants';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scanStream: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
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

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    accountService = module.get(AccountService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createSession', () => {
    it('올바른 키로 Redis에 저장', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await accountService.createSession(user, userAgent, refreshToken, userIp);

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

      await accountService.createSession(user, userAgent, refreshToken, userIp);

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

      const result = await accountService.findSession(user, userAgent);

      const expectedKey = getSessionId(user.id, userAgent);
      expect(mockRedisClient.get).toHaveBeenCalledWith(expectedKey);
      expect(result).toMatchObject({ userId: user.id, refreshToken });
    });

    it('세션 없으면 null 반환', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await accountService.findSession(user, userAgent);

      expect(result).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('올바른 키로 삭제 호출', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await accountService.deleteSession(user, userAgent);

      const expectedKey = getSessionId(user.id, userAgent);
      expect(mockRedisClient.del).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('deleteAllUserSessions', () => {
    const makeAsyncIterable = (batches: string[][]) => ({
      [Symbol.asyncIterator]: async function* () {
        for (const batch of batches) yield batch;
      },
    });

    it('유저의 모든 세션 키 삭제', async () => {
      const keys = [getSessionId(user.id, 'agent1'), getSessionId(user.id, 'agent2')];
      mockRedisClient.scanStream.mockReturnValue(makeAsyncIterable([keys]));
      mockRedisClient.del.mockResolvedValue(2);

      await accountService.deleteAllUserSessions(user);

      expect(mockRedisClient.scanStream).toHaveBeenCalledWith({ match: `${user.id}:*` });
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
    });

    it('세션 없으면 del 호출 안 함', async () => {
      mockRedisClient.scanStream.mockReturnValue(makeAsyncIterable([[]]));

      await accountService.deleteAllUserSessions(user);

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('blacklistToken', () => {
    it('올바른 키와 TTL로 저장', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      const token = 'some.jwt.token';
      const remainingMs = 3600000;

      await accountService.blacklistToken(token, remainingMs);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `blacklist:${token}`,
        '1',
        'PX',
        remainingMs,
      );
    });
  });

  describe('isBlacklisted', () => {
    it('블랙리스트에 있으면 true', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      const result = await accountService.isBlacklisted('some.token');

      expect(result).toBe(true);
    });

    it('블랙리스트에 없으면 false', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await accountService.isBlacklisted('some.token');

      expect(result).toBe(false);
    });
  });

  describe('isAccountLocked', () => {
    it('lock 키 있으면 true', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      const result = await accountService.isAccountLocked(user);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`login:lock:${user.id}`);
      expect(result).toBe(true);
    });

    it('lock 키 없으면 false', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await accountService.isAccountLocked(user);

      expect(result).toBe(false);
    });
  });

  describe('incrementAccFailCount', () => {
    it('첫 번째 실패 시 TTL 설정', async () => {
      mockRedisClient.incr.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);

      await accountService.incrementAccFailCount(user);

      expect(mockRedisClient.expire).toHaveBeenCalledWith(`login:fail:${user.id}`, 600);
    });

    it('첫 번째 실패가 아니면 TTL 설정 안 함', async () => {
      mockRedisClient.incr.mockResolvedValue(2);

      await accountService.incrementAccFailCount(user);

      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it('5번째 실패 시 lock 키 설정', async () => {
      mockRedisClient.incr.mockResolvedValue(5);
      mockRedisClient.set.mockResolvedValue('OK');

      await accountService.incrementAccFailCount(user);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `login:lock:${user.id}`,
        '1',
        'EX',
        1800,
      );
    });

    it('5번 미만 실패 시 lock 키 설정 안 함', async () => {
      mockRedisClient.incr.mockResolvedValue(4);

      await accountService.incrementAccFailCount(user);

      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('resetAccFailCount', () => {
    it('fail 키와 lock 키 모두 삭제', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await accountService.resetAccFailCount(user);

      expect(mockRedisClient.del).toHaveBeenCalledWith(`login:fail:${user.id}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`login:lock:${user.id}`);
    });
  });
});

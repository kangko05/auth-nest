import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { USER_REPOSITORY } from './constants';

const mockUser: User = {
  id: 'uuid-1',
  email: 'test@test.com',
  password: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

describe('UsersService', () => {
  let usersService: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
      ],
    }).compile();

    usersService = module.get(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findByEmail', () => {
    it('존재하는 유저 반환', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findByEmail(mockUser.email);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email },
      });
      expect(result).toEqual(mockUser);
    });

    it('존재하지 않으면 null 반환', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await usersService.findByEmail('none@test.com');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('유저 생성 후 반환', async () => {
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const dto = { email: mockUser.email, password: mockUser.password };
      const result = await usersService.create(dto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(dto);
      expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByUserId', () => {
    it('존재하는 유저 반환', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findByUserId(mockUser.id);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).toEqual(mockUser);
    });

    it('존재하지 않으면 null 반환', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await usersService.findByUserId('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateUserBanStatus', () => {
    it('밴 처리 시 affected 반환', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await usersService.updateUserBanStatus(mockUser.id, true);

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, { isBanned: true });
      expect(result).toBe(1);
    });

    it('존재하지 않는 유저면 0 반환', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 0 });

      const result = await usersService.updateUserBanStatus('non-existent-id', true);

      expect(result).toBe(0);
    });
  });
});

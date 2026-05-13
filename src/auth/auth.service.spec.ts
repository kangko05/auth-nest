import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Test } from '@nestjs/testing';
import { UsersService } from 'src/users/users.service';

const mockUserService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUserService },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  const userDto = { email: 'test@test.com', password: 'test1234!' };

  it('정상 가입', async () => {
    mockUserService.findByEmail.mockResolvedValue(null);
    mockUserService.create.mockResolvedValue({});

    await authService.register(userDto);

    expect(mockUserService.create).toHaveBeenCalled();
  });

  it('중복 아이디', async () => {
    mockUserService.findByEmail.mockResolvedValue(userDto);

    await expect(authService.register(userDto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('비밀번호 해시되어 저장', async () => {
    mockUserService.findByEmail.mockResolvedValue(null);
    mockUserService.create.mockResolvedValue({ id: '1' });

    await authService.register(userDto);

    const calledWith = mockUserService.create.mock.calls[0][0];

    expect(calledWith.password).not.toBe(userDto.password);
  });
});

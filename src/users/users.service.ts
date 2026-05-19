import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateOauthUserDto, CreateUserDto } from './dto/create-user.dto';
import { USER_REPOSITORY } from './constants';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByUserId(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async create(dto: CreateUserDto | CreateOauthUserDto): Promise<User> {
    const user = this.userRepository.create(dto);
    return this.userRepository.save(user);
  }

  async updateUserBanStatus(userId: string, isBanned: boolean) {
    const result = await this.userRepository.update(userId, { isBanned });
    return result.affected ?? 0;
  }

  async createOrUpdateOauthUser(dto: CreateOauthUserDto) {
    const existing = await this.findByEmail(dto.email);

    if (existing) {
      await this.userRepository.update(existing.id, {
        ...existing,
        provider: dto.provider,
        providerId: dto.providerId,
      });

      return {
        ...existing,
        provider: dto.provider,
        providerId: dto.providerId,
      };
    }

    return this.create(dto);
  }
}

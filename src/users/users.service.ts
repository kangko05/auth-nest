import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { USER_REPOSITORY } from './constants';
import { CreateOauthUserDto, CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: Repository<User>,
  ) { }

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
    await this.userRepository.upsert({ ...dto }, ['email']);

    return this.findByEmail(dto.email);
  }

  async updateUserPassword(
    id: string,
    hashedPassword: string,
  ): Promise<number> {
    const result = await this.userRepository.update(id, {
      password: hashedPassword,
      tokenValidAfter: new Date(),
    });

    return result.affected ?? 0;
  }
}

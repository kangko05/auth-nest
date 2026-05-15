import * as bcrypt from 'bcrypt';
import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { UserCreatedDto } from '../users/dto/user-response.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: CreateUserDto): Promise<UserCreatedDto> {
    const foundUser = await this.userService.findByEmail(registerDto.email);

    if (foundUser) {
      throw new ConflictException('이미 사용 중인 이메일 입니다.');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const createdUser = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    return { email: createdUser.email, createdAt: createdUser.createdAt };
  }

  async login(user: User): Promise<{ access_token: string }> {
    return {
      access_token: await this.jwtService.signAsync({ sub: user.id }),
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const foundUser = await this.userService.findByEmail(email);

    if (!foundUser || !(await bcrypt.compare(password, foundUser.password)))
      return null;

    return foundUser;
  }
}

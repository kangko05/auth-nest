import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', description: '이메일' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    minLength: 8,
    description:
      '비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.',
  })
  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, {
    message: '비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.',
  })
  password: string;
}

export class CreateOauthUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  provider: string;

  @IsNotEmpty()
  providerId: string;
}

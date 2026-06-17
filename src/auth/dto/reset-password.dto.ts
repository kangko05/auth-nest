import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class ConfirmPasswordDto {
  @IsNotEmpty()
  token: string

  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, {
    message: '비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.',
  })
  password: string;
}

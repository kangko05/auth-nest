import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, {
    message: '비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.',
  })
  @IsNotEmpty()
  password: string;
}

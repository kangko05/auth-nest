import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendPasswordResetEmail(email: string, token: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'auth-nest 비밀번호 재설정',
      html: `<html><a href=http://localhost:3000/auth/password-reset/confirm?token=${token}>click</a></html>`,
    });
  }
}

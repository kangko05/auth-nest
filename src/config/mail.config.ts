import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  return {
    user: user,
    pass: pass,
    enabled: !!(user && pass),
  };
});

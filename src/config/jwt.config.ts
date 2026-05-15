import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? '',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '60s',

  refreshSecret: process.env.REFRESH_SECRET ?? '',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN ?? '7d',
}));

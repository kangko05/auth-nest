import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  ttl: process.env.THROTTLE_TTL ?? 60000,
  limit: process.env.THROTTLE_LIMIT ?? 5,
}));

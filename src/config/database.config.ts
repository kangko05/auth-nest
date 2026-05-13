import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306'),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASS ?? 'root',
  database: process.env.DB_NAME ?? 'test',
}));

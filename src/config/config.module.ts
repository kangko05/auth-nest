import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import Joi from 'joi';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import redisConfig from './redis.config';
import throttleConfig from './throttle.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
      load: [databaseConfig, jwtConfig, redisConfig, throttleConfig],
      isGlobal: true,
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().required(),
        REFRESH_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('60s'),
        REFRESH_EXPIRES_IN: Joi.string().default('7d'),

        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASS: Joi.string().required(),
        DB_NAME: Joi.string().required(),

        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),

        THROTTLE_TTL: Joi.number().default(60000),
        THROTTLE_LIMIT: Joi.number().default(10),

        ALLOWED_ORIGIN: Joi.string().required(),
      }),
    }),
  ],
})
export class ConfigModule {}

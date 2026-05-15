import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import databaseConfig from './database.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
      load: [databaseConfig],
      isGlobal: true,
    }),
  ],
})
export class ConfigModule {}

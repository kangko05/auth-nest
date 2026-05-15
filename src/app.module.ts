import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [ConfigModule, DatabaseModule, UsersModule, AuthModule, RedisModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

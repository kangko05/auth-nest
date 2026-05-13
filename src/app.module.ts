import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
      load: [databaseConfig],
      isGlobal: true,
    }),
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

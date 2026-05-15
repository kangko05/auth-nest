import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DATA_SOURCE, REDIS_CLIENT } from './constants';
import Redis from 'ioredis';

export const databaseProviders = [
  {
    provide: DATA_SOURCE,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
      const nodeEnv = configService.get('NODE_ENV');
      const dataSource = new DataSource({
        type: 'mysql',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: nodeEnv !== 'prod' && nodeEnv !== 'production',
      });

      return dataSource.initialize();
    },
  },
  {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      return new Redis({
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
      });
    },
  },
];

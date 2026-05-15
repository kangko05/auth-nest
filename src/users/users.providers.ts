import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { USER_REPOSITORY } from './constants';
import { DATA_SOURCE } from '../database/constants';

export const userProviders = [
  {
    provide: USER_REPOSITORY,
    useFactory: (dataSource: DataSource) => dataSource.getRepository(User),
    inject: [DATA_SOURCE],
  },
];

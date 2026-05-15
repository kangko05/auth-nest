import { Module } from '@nestjs/common';
import { databaseProviders } from './database.providers';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown() {
    const dataSource = this.moduleRef.get<DataSource>('DATA_SOURCE');
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

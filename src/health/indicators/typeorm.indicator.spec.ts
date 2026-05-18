import { Test } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { TypeOrmHealthIndicator } from './typeorm.indicator';
import { DATA_SOURCE } from '../../database/constants';

const upResult = { typeOrm: { status: 'up' } };
const downResult = { typeOrm: { status: 'down' } };

const mockIndicator = {
  up: jest.fn().mockReturnValue(upResult),
  down: jest.fn().mockReturnValue(downResult),
};

const mockHealthIndicatorService = {
  check: jest.fn().mockReturnValue(mockIndicator),
};

const mockDataSource = {
  query: jest.fn(),
};

describe('TypeOrmHealthIndicator', () => {
  let indicator: TypeOrmHealthIndicator;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TypeOrmHealthIndicator,
        { provide: HealthIndicatorService, useValue: mockHealthIndicatorService },
        { provide: DATA_SOURCE, useValue: mockDataSource },
      ],
    }).compile();

    indicator = module.get(TypeOrmHealthIndicator);
  });

  afterEach(() => jest.clearAllMocks());

  it('쿼리 성공 시 up 반환', async () => {
    mockDataSource.query.mockResolvedValue([{ '1': 1 }]);

    const result = await indicator.pingCheck('typeOrm');

    expect(result).toBe(upResult);
  });

  it('쿼리 실패 시 down 반환', async () => {
    mockDataSource.query.mockRejectedValue(new Error('connection refused'));

    const result = await indicator.pingCheck('typeOrm');

    expect(result).toBe(downResult);
    expect(mockIndicator.down).toHaveBeenCalledWith({ message: 'connection refused' });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { DATA_SOURCE } from '../src/database/constants';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const dto = { email: 'e2e@test.com', password: 'Test1234!' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = app.get<DataSource>(DATA_SOURCE);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM \`user\` WHERE email = '${dto.email}'`);
    await app.close();
  });

  it('DB 연결 확인', () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('POST /auth/register - 정상 가입', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(dto)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toHaveProperty('email', dto.email);
        expect(body).toHaveProperty('createdAt');
        expect(body).not.toHaveProperty('password');
      });
  });

  it('POST /auth/register - 중복 이메일', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(dto)
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe('이미 사용 중인 이메일 입니다.');
      });
  });

  it('POST /auth/register - 잘못된 비밀번호 형식', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e2@test.com', password: '1234' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain(
          '비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.',
        );
      });
  });

  const testAgent = 'Mozilla/5.0 (Test)';

  it('POST /auth/login - 정상 로그인', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send(dto)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toHaveProperty('access_token');
        expect(typeof body.access_token).toBe('string');
      });
  });

  it('POST /auth/login - 잘못된 비밀번호', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send({ ...dto, password: 'WrongPass1!' })
      .expect(401);
  });

  it('POST /auth/login - 존재하지 않는 이메일', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send({ email: 'none@test.com', password: dto.password })
      .expect(401);
  });

  it('POST /auth/refresh - 정상 갱신', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send(dto);

    const cookies = loginRes.headers['set-cookie'];

    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('User-Agent', testAgent)
      .set('Cookie', cookies)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toHaveProperty('access_token');
        expect(typeof body.access_token).toBe('string');
      });
  });

  it('POST /auth/refresh - 쿠키 없으면 401', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('User-Agent', testAgent)
      .expect(401);
  });

  it('POST /auth/refresh - 유효하지 않은 토큰 401', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('User-Agent', testAgent)
      .set('Cookie', 'refresh_token=invalid.token.here')
      .expect(401);
  });

  it('DELETE /auth/logout - 정상 로그아웃', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send(dto);

    const accessToken = loginRes.body.access_token;

    return request(app.getHttpServer())
      .delete('/auth/logout')
      .set('User-Agent', testAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });

  it('DELETE /auth/logout - 토큰 없으면 401', () => {
    return request(app.getHttpServer()).delete('/auth/logout').expect(401);
  });

  it('DELETE /auth/logout - UA 없이 로그아웃 시 204', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send(dto);

    const accessToken = loginRes.body.access_token;

    return request(app.getHttpServer())
      .delete('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });

  it('DELETE /auth/logout - 로그아웃 후 동일 access token 사용 시 401', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send(dto);

    const accessToken = loginRes.body.access_token;

    await request(app.getHttpServer())
      .delete('/auth/logout')
      .set('User-Agent', testAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    return request(app.getHttpServer())
      .delete('/auth/logout')
      .set('User-Agent', testAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('DELETE /auth/logout - 로그아웃 후 refresh 시도 시 401', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', testAgent)
      .send(dto);

    const accessToken = loginRes.body.access_token;
    const cookies = loginRes.headers['set-cookie'];

    await request(app.getHttpServer())
      .delete('/auth/logout')
      .set('User-Agent', testAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('User-Agent', testAgent)
      .set('Cookie', cookies)
      .expect(401);
  });
});

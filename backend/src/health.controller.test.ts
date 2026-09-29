import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the backend health status', async () => {
    const server = app.getHttpServer() as Server;
    const response = await request(server).get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});

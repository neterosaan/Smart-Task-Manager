import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';

import request from 'supertest';
const app = require('../app');
const Task = require('../models/taskModel');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

const TOLERANCE_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

const expectCloseTo = (actualISO, expectedMs, toleranceMs = TOLERANCE_MS) => {
  const diff = Math.abs(new Date(actualISO).getTime() - expectedMs);
  expect(diff).toBeLessThan(toleranceMs);
};

describe('Task recurrence & due-date pre-save logic', () => {
  beforeAll(async () => {
    await connectTestDb();
    await Task.init();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createUser = async (overrides = {}) => {
    const res = await request(app)
      .post('/api/v1/users/signup')
      .send({
        name: 'alice',
        email: 'alice@test.com',
        password: 'password123',
        passwordConfirm: 'password123',
        ...overrides,
      });
    if (res.status !== 201) {
      throw new Error(
        `createUser test helper failed: signup returned ${res.status} - ${JSON.stringify(res.body)}`
      );
    }
    return { token: res.body.accessToken, userId: res.body.data.user._id };
  };

  const baseTask = (overrides = {}) => ({
    title: 'Task title',
    description: 'Task description',
    ...overrides,
  });

  describe('recurrence: "none"', () => {
    it('requires a dueDate', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(baseTask({ recurrence: 'none' }));

      expect(res.status).toBe(400);
    });

    it('keeps the client-supplied dueDate as-is', async () => {
      const { token } = await createUser();
      const dueDate = new Date(Date.now() + 3 * DAY_MS).toISOString();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(baseTask({ recurrence: 'none', dueDate }));

      expect(res.status).toBe(201);
      expect(new Date(res.body.data.task.dueDate).getTime()).toBe(new Date(dueDate).getTime());
    });

    it('sets reminder to createdAt + 1/4 of the (dueDate - createdAt) interval', async () => {
      const { token } = await createUser();
      const dueDate = new Date(Date.now() + 4 * DAY_MS).toISOString();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(baseTask({ recurrence: 'none', dueDate }));

      expect(res.status).toBe(201);
      const { createdAt, dueDate: savedDueDate, reminder } = res.body.data.task;
      const expectedReminder = Math.trunc(
        new Date(createdAt).getTime() +
          (new Date(savedDueDate).getTime() - new Date(createdAt).getTime()) / 4
      );

      expect(new Date(reminder).getTime()).toBe(expectedReminder);
    });
  });

  describe('recurrence overrides dueDate at creation, and skips reminder', () => {
    it('daily: sets dueDate to ~24 hours out, ignoring any client-supplied dueDate', async () => {
      const { token } = await createUser();
      const before = Date.now();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(
          baseTask({
            recurrence: 'daily',
            dueDate: new Date(Date.now() + 30 * DAY_MS).toISOString(),
          })
        );

      expect(res.status).toBe(201);
      expectCloseTo(res.body.data.task.dueDate, before + DAY_MS);
    });

    it('weekly: sets dueDate to ~7 days out', async () => {
      const { token } = await createUser();
      const before = Date.now();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(baseTask({ recurrence: 'weekly' }));

      expect(res.status).toBe(201);
      expectCloseTo(res.body.data.task.dueDate, before + 7 * DAY_MS);
    });

    it('monthly: sets dueDate to ~1 calendar month out', async () => {
      const { addMonths } = require('date-fns');
      const { token } = await createUser();
      const before = new Date();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(baseTask({ recurrence: 'monthly' }));

      expect(res.status).toBe(201);
      expectCloseTo(res.body.data.task.dueDate, addMonths(before, 1).getTime());
    });

    it('does not set a reminder for a recurring task', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(baseTask({ recurrence: 'daily' }));

      expect(res.status).toBe(201);
      expect(res.body.data.task.reminder).toBeFalsy();
    });
  });

  describe('changing recurrence on an existing task', () => {
    it('recalculates dueDate when recurrence changes from none to daily', async () => {
      const { token } = await createUser();
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(
          baseTask({
            recurrence: 'none',
            dueDate: new Date(Date.now() + 30 * DAY_MS).toISOString(),
          })
        );
      const before = Date.now();

      const res = await request(app)
        .patch(`/api/v1/tasks/${createRes.body.data.task._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ recurrence: 'daily' });

      expect(res.status).toBe(200);
      expectCloseTo(res.body.data.task.dueDate, before + DAY_MS);
    });
  });

  describe('reminder immutability on update (known limitation)', () => {
    it('does NOT recalculate reminder when dueDate is changed on an existing task', async () => {
      const { token } = await createUser();
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(
          baseTask({
            recurrence: 'none',
            dueDate: new Date(Date.now() + 4 * DAY_MS).toISOString(),
          })
        );
      const originalReminder = createRes.body.data.task.reminder;
      expect(originalReminder).toBeTruthy();

      const res = await request(app)
        .patch(`/api/v1/tasks/${createRes.body.data.task._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ dueDate: new Date(Date.now() + 20 * DAY_MS).toISOString() });

      expect(res.status).toBe(200);

      expect(new Date(res.body.data.task.reminder).getTime()).toBe(
        new Date(originalReminder).getTime()
      );
    });
  });
});

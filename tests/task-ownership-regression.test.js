import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const User = require('../models/userModel.js');
const Task = require('../models/taskModel.js');
const app = require('../app');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ id }, secret, { expiresIn: '1d' });
};

describe('Task Ownership & Isolation (Regression Tests)', () => {
  let userAToken, userBToken, userATask;

  beforeAll(async () => {
    await connectTestDb();
    await User.init();
    await Task.init();
  });

  beforeEach(async () => {
    await resetDb();

    const userA = await User.create({
      name: 'UserA',
      email: 'usera@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    userAToken = generateToken(userA._id);

    const userB = await User.create({
      name: 'UserB',
      email: 'userb@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    userBToken = generateToken(userB._id);

    userATask = await Task.create({
      title: 'User A Confidential Task',
      description: 'Confidential details for User A only',
      user: userA._id,
      dueDate: new Date(),
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('REGRESSION: should not allow User B to fetch User A task by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${userATask._id}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect([403, 404]).toContain(res.status);
  });

  it('REGRESSION: should not reveal User A task when User B lists all tasks', async () => {
    const res = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);

    const rawData =
      res.body.data?.tasks ||
      res.body.data?.data ||
      (Array.isArray(res.body.data) ? res.body.data : null) ||
      res.body.tasks ||
      [];

    const tasks = Array.isArray(rawData) ? rawData : [];
    expect(tasks).toHaveLength(0);
  });

  it('REGRESSION: should block User B from updating User A task', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${userATask._id}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ title: 'Hacked Title' });

    expect([403, 404]).toContain(res.status);

    const checkTask = await Task.findById(userATask._id);
    expect(checkTask.title).toBe('User A Confidential Task');
  });

  it('REGRESSION: should block User B from deleting User A task', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${userATask._id}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect([403, 404]).toContain(res.status);

    const checkTask = await Task.findById(userATask._id);
    expect(checkTask).not.toBeNull();
  });
});

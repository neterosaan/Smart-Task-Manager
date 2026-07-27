import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'

import request from 'supertest';
const app = require('../app');
const Task = require('../models/taskModel');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

describe('Tasks', () => {
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
        `createUser test helper failed: signup returned ${res.status} - ${JSON.stringify(res.body)}`,
      );
    }
    return { token: res.body.accessToken, userId: res.body.data.user._id };
  };

  const validTask = (overrides = {}) => ({
    title: 'Buy groceries',
    description: 'Milk, eggs, bread',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    priority: 'Mid',
    category: 'Personal',
    ...overrides,
  });

  describe('POST /api/v1/tasks', () => {
    it('creates a task for the authenticated user', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(validTask());

      expect(res.status).toBe(201);
      expect(res.body.data.task.title).toBe('Buy groceries');
      expect(res.body.data.task.status).toBe('Pending');
    });

    it('rejects a request with no auth token', async () => {
      const res = await request(app).post('/api/v1/tasks').send(validTask());
      expect(res.status).toBe(401);
    });

    it('rejects a task that tries to assign a teamId', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(validTask({ teamId: '64b8f0f0f0f0f0f0f0f0f0f0' }));

      expect(res.status).toBe(400);
    });

    it('allows two different users to have a task with the same title', async () => {
      const alice = await createUser();
      const bob = await createUser({ name: 'bobby', email: 'bob@test.com' });

      const aliceRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(validTask({ title: 'Shared title' }));
      const bobRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${bob.token}`)
        .send(validTask({ title: 'Shared title' }));

      expect(aliceRes.status).toBe(201);
      expect(bobRes.status).toBe(201);
    });

    it('rejects a duplicate title for the same user', async () => {
      const { token } = await createUser();

      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(validTask({ title: 'Same title' }));

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(validTask({ title: 'Same title' }));

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/tasks', () => {
    it("only returns the authenticated user's own tasks", async () => {
      const alice = await createUser();
      const bob = await createUser({ name: 'bobby', email: 'bob@test.com' });

      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(validTask({ title: "Alice's task" }));
      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${bob.token}`)
        .send(validTask({ title: "Bob's task" }));

      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toBe(1);
      expect(res.body.data.data[0].title).toBe("Alice's task");
    });
  });

  describe('Ownership boundary (GET/PATCH/DELETE /api/v1/tasks/:id)', () => {


    const setupTwoUsersAndTask = async () => {
      const alice = await createUser();
      const bob = await createUser({ name: 'bobby', email: 'bob@test.com' });

      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(validTask());

      return { alice, bob, taskId: createRes.body.data.task._id };
    };

    it("returns 404 (not the task) when getting another user's task", async () => {
      const { bob, taskId } = await setupTwoUsersAndTask();

      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 when updating another user's task, and does not modify it", async () => {
      const { bob, taskId } = await setupTwoUsersAndTask();

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ title: 'Hijacked' });

      expect(res.status).toBe(404);

      const stillOriginal = await Task.findById(taskId);
      expect(stillOriginal.title).toBe('Buy groceries');
    });

    it("returns 404 when deleting another user's task, and does not delete it", async () => {
      const { bob, taskId } = await setupTwoUsersAndTask();

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${bob.token}`);

      expect(res.status).toBe(404);

      const stillThere = await Task.findById(taskId);
      expect(stillThere).not.toBeNull();
    });

    it('does not reassign a task to another user via a PATCH body ("user" field)', async () => {

      const { alice, bob, taskId } = await setupTwoUsersAndTask();

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ title: 'Still mine', user: bob.userId });

      expect(res.status).toBe(200);
      expect(res.body.data.task.user.toString()).toBe(alice.userId);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('updates allowed fields on your own task', async () => {
      const { token } = await createUser();
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(validTask());

      const res = await request(app)
        .patch(`/api/v1/tasks/${createRes.body.data.task._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated title', priority: 'High' });

      expect(res.status).toBe(200);
      expect(res.body.data.task.title).toBe('Updated title');
      expect(res.body.data.task.priority).toBe('High');
    });

    it('returns 404 for a task id that does not exist', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .patch('/api/v1/tasks/64b8f0f0f0f0f0f0f0f0f0f0')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Does not matter' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/tasks (deleteUnfinishedTask)', () => {
    it("only deletes the authenticated user's Unfinished tasks", async () => {
      const alice = await createUser();
      const bob = await createUser({ name: 'bobby', email: 'bob@test.com' });

      const aliceTask = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${alice.token}`)
        .send(validTask({ title: "Alice's stale task" }));
      const bobTask = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${bob.token}`)
        .send(validTask({ title: "Bob's stale task" }));

      await request(app)
        .patch(`/api/v1/tasks/${aliceTask.body.data.task._id}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ status: 'Unfinished' });
      await request(app)
        .patch(`/api/v1/tasks/${bobTask.body.data.task._id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ status: 'Unfinished' });

      const res = await request(app)
        .delete('/api/v1/tasks')
        .set('Authorization', `Bearer ${alice.token}`);

      expect(res.status).toBe(204);

      const bobsTaskStillExists = await Task.findById(bobTask.body.data.task._id);
      expect(bobsTaskStillExists).not.toBeNull();
    });

    it('returns 404 when there are no unfinished tasks', async () => {
      const { token } = await createUser();

      const res = await request(app)
        .delete('/api/v1/tasks')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
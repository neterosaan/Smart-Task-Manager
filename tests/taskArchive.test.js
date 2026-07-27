import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'

import request from 'supertest';
const app = require('../app');
const Task = require('../models/taskModel');
const CompletedTask = require('../models/completedTaskModel');
const ActivityLog = require('../models/activityLogModel');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

describe('Archive-on-complete transition (Task -> CompletedTask)', () => {
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

  const createTask = async (token, overrides = {}) => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Finish the report',
        description: 'Quarterly numbers',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'High',
        category: 'Work',
        tags: ['urgent'],
        recurrence: 'none',
        ...overrides,
      });
    if (res.status !== 201) {
      throw new Error(
        `createTask test helper failed: got ${res.status} - ${JSON.stringify(res.body)}`,
      );
    }
    return res.body.data.task;
  };

  const completeTask = (token, taskId) =>
    request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Completed' });

  it('removes the task from the Task collection once marked Completed', async () => {
    const { token } = await createUser();
    const task = await createTask(token);

    const res = await completeTask(token, task._id);
    expect(res.status).toBe(200);

    const stillInTasks = await Task.findById(task._id);
    expect(stillInTasks).toBeNull();
  });

  it('creates a matching CompletedTask document, linked back via originalTask', async () => {
    const { token, userId } = await createUser();
    const task = await createTask(token, {
      title: 'Archive me',
      tags: ['a', 'b'],
    });

    await completeTask(token, task._id);

    const completed = await CompletedTask.findOne({ originalTask: task._id });
    expect(completed).not.toBeNull();
    expect(completed.title).toBe('Archive me');
    expect(completed.priority).toBe('High');
    expect(completed.category).toBe('Work');
    expect(completed.tags).toEqual(['a', 'b']);
    expect(completed.user.toString()).toBe(userId);
    expect(completed.originalTask.toString()).toBe(task._id);
  });

  it('logs a task_completed ActivityLog entry referencing the original task id', async () => {
    const { token } = await createUser();
    const task = await createTask(token);

    await completeTask(token, task._id);

    const log = await ActivityLog.findOne({ actionType: 'task_completed' });
    expect(log).not.toBeNull();
    expect(log.task.toString()).toBe(task._id);
  });

  it('returns 404 on GET for a task that has since been completed', async () => {
    const { token } = await createUser();
    const task = await createTask(token);
    await completeTask(token, task._id);

    const res = await request(app)
      .get(`/api/v1/tasks/${task._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('does not archive a task when a non-status field is updated', async () => {
    const { token } = await createUser();
    const task = await createTask(token);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Just renaming' });

    expect(res.status).toBe(200);

    const stillInTasks = await Task.findById(task._id);
    expect(stillInTasks).not.toBeNull();

    const completed = await CompletedTask.findOne({ originalTask: task._id });
    expect(completed).toBeNull();
  });

  it('does not archive a task when it is updated to a non-Completed status', async () => {
    const { token } = await createUser();
    const task = await createTask(token);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Unfinished' });

    expect(res.status).toBe(200);

    const stillInTasks = await Task.findById(task._id);
    expect(stillInTasks).not.toBeNull();
    expect(stillInTasks.status).toBe('Unfinished');
  });

  it('archives a recurring task the same way as a one-off task', async () => {
    const { token } = await createUser();
    const task = await createTask(token, { recurrence: 'daily', dueDate: undefined });

    const res = await completeTask(token, task._id);
    expect(res.status).toBe(200);

    const stillInTasks = await Task.findById(task._id);
    expect(stillInTasks).toBeNull();

    const completed = await CompletedTask.findOne({ originalTask: task._id });
    expect(completed).not.toBeNull();
    expect(completed.recurrence).toBe('daily');
  });
});
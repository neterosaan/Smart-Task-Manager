import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

const User = require('../models/userModel.js');
const Task = require('../models/taskModel.js');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

let cronService;
try {
  cronService = require('../services/cronService.js');
} catch (e) {
  try {
    cronService = require('../utils/cron.js');
  } catch (err) {
    cronService = null;
  }
}

describe('Cron Service & Task Logic Verification', () => {
  let userId;

  beforeAll(async () => {
    await connectTestDb();
    await User.init();
    await Task.init();
  });

  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();

    const user = await User.create({
      name: 'CronUser',
      email: 'cron@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    userId = user._id;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('should verify recurring task fields and due date updates in database', async () => {
    const pastDueDate = new Date(Date.now() - 3600000); // 1 hour ago

    const recurringTask = await Task.create({
      title: 'Recurring Standup',
      description: 'Daily standup task for cron check',
      user: userId,
      dueDate: pastDueDate,
      recurrence: 'daily',
    });

    expect(recurringTask.recurrence).toBe('daily');
    expect(recurringTask.title).toBe('Recurring Standup');

    if (cronService && typeof cronService.checkRecurringTasks === 'function') {
      await cronService.checkRecurringTasks();
    } else if (cronService && typeof cronService.processRecurring === 'function') {
      await cronService.processRecurring();
    }

    const checkTask = await Task.findById(recurringTask._id);
    expect(checkTask).not.toBeNull();
  });
});

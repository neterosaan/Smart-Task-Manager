import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
const mongoose = require('mongoose');
import { connectTestDb, resetDb, disconnectTestDb } from './setup/testDb';

describe('test harness', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('can write to and read from the real test database', async () => {
    const User = require('../models/userModel');
    const user = await User.create({
      name: 'harness',
      email: 'harness@test.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    const found = await User.findById(user._id);
    expect(found).not.toBeNull();
  });

  it("resetDb actually wiped the previous test's user", async () => {
    const User = require('../models/userModel');
    const count = await User.countDocuments();
    expect(count).toBe(0);
  });
});

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';

const User = require('../models/userModel.js');
const app = require('../app');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

describe('Auth - Password Reset Flow & Edge Cases', () => {
  beforeAll(async () => {
    await connectTestDb();
    await User.init();
  });

  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('should issue a password reset token and update password successfully', async () => {
    const plainResetToken = 'test-known-reset-token-123456';
    const hashedResetToken = crypto.createHash('sha256').update(plainResetToken).digest('hex');

    if (User.prototype.createPasswordResetToken) {
      vi.spyOn(User.prototype, 'createPasswordResetToken').mockImplementation(function () {
        this.passwordResetToken = hashedResetToken;
        this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        return plainResetToken;
      });
    }

    const user = await User.create({
      name: 'ResetUser',
      email: 'reset@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });

    const forgotRes = await request(app)
      .post('/api/v1/users/forgotPassword')
      .send({ email: 'reset@example.com' });

    expect(forgotRes.status).toBe(200);

    const updatedUser = await User.findById(user._id).select(
      '+passwordResetToken +passwordResetExpires'
    );
    expect(updatedUser.passwordResetToken).toBeDefined();
    expect(updatedUser.passwordResetExpires).toBeDefined();

    const resetToken = forgotRes.body.resetToken || plainResetToken;
    const resetRes = await request(app).patch(`/api/v1/users/resetPassword/${resetToken}`).send({
      password: 'newPassword123',
      passwordConfirm: 'newPassword123',
    });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.status || resetRes.body.token).toBeDefined();

    const oldLogin = await request(app)
      .post('/api/v1/users/login')
      .send({ email: 'reset@example.com', password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/users/login')
      .send({ email: 'reset@example.com', password: 'newPassword123' });
    expect(newLogin.status).toBe(200);
  });

  it('should reject password reset if token is invalid or expired', async () => {
    const res = await request(app).patch('/api/v1/users/resetPassword/invalidtoken12345').send({
      password: 'newPassword123',
      passwordConfirm: 'newPassword123',
    });

    expect(res.status).toBe(400);
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'



import request from 'supertest';
const app = require('../app');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

describe('Auth', () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const validUser = {
    name: 'alice',
    email: 'alice@test.com',
    password: 'password123',
    passwordConfirm: 'password123',
  };

  describe('POST /api/v1/users/signup', () => {
    it('creates a new user and returns an access token', async () => {
      const res = await request(app).post('/api/v1/users/signup').send(validUser);
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('alice@test.com');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('rejects a password/passwordConfirm mismatch', async () => {
      const res = await request(app)
        .post('/api/v1/users/signup')
        .send({ ...validUser, passwordConfirm: 'somethingElse' });

      expect(res.status).toBe(400);
    });

    it('rejects a duplicate email', async () => {
      await request(app).post('/api/v1/users/signup').send(validUser);

      const res = await request(app)
        .post('/api/v1/users/signup')
        .send({ ...validUser, name: 'alicetoo' });

      expect(res.status).toBe(400);  
    });

    it('sets an httpOnly refresh token cookie', async () => {
      const res = await request(app).post('/api/v1/users/signup').send(validUser);
      const cookie = res.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
    });
  });

  describe('POST /api/v1/users/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/users/signup').send(validUser);
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/users/login')
        .send({ email: 'alice@test.com', password: 'password123' });
    
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects an incorrect password with a generic message', async () => {
      const res = await request(app)
        .post('/api/v1/users/login')
        .send({ email: 'alice@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Incorrect email or password!');
    });

    it('rejects a missing password with a 400', async () => {
      const res = await request(app)
        .post('/api/v1/users/login')
        .send({ email: 'alice@test.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('protect middleware (GET /api/v1/users/me)', () => {
    it('rejects a request with no Authorization header', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('rejects a garbage token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('returns the current user for a valid token', async () => {
      const signupRes = await request(app).post('/api/v1/users/signup').send(validUser);
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${signupRes.body.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('alice@test.com');
    });
  });

  describe('POST /api/v1/users/refresh-token', () => {
    it('issues a new access token given a valid refresh cookie', async () => {
      const signupRes = await request(app).post('/api/v1/users/signup').send(validUser);
      const cookie = signupRes.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));

      const res = await request(app).post('/api/v1/users/refresh-token').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects a refresh attempt with no cookie at all', async () => {
      const res = await request(app).post('/api/v1/users/refresh-token');
      expect(res.status).toBe(401);
    });
  });

  describe('Password reset flow', () => {
    it('resets the password with a valid token and can log in with the new password', async () => {
      await request(app).post('/api/v1/users/signup').send(validUser);

      const User = require('../models/userModel');
      const user = await User.findOne({ email: 'alice@test.com' });
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .patch(`/api/v1/users/resetpassword/${resetToken}`)
        .send({ password: 'newpassword123', passwordConfirm: 'newpassword123' });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/v1/users/login')
        .send({ email: 'alice@test.com', password: 'newpassword123' });
      expect(loginRes.status).toBe(200);
    });

    it('rejects an invalid/expired reset token', async () => {
      const res = await request(app)
        .patch('/api/v1/users/resetpassword/not-a-real-token')
        .send({ password: 'newpassword123', passwordConfirm: 'newpassword123' });

      expect(res.status).toBe(400);
    });
  });
});
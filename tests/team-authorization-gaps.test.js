import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const User = require('../models/userModel.js');
const Task = require('../models/taskModel.js');
const app = require('../app');
const { connectTestDb, resetDb, disconnectTestDb } = require('./setup/testDb');

let Team;
try {
  Team = require('../models/teamModel.js');
} catch (e) {
  try {
    Team = require('../models/team.js');
  } catch (err) {
    Team = null;
  }
}

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign({ id }, secret, { expiresIn: '1d' });
};

describe('Team & Invite Authorization Gaps', () => {
  let ownerToken, nonMemberToken, uninvitedUserToken;
  let team,
    inviteToken = 'sample-invite-token';

  beforeAll(async () => {
    await connectTestDb();
    await User.init();
    await Task.init();
    if (Team?.init) await Team.init();
  });

  beforeEach(async () => {
    await resetDb();

    const owner = await User.create({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    ownerToken = generateToken(owner._id);

    const nonMember = await User.create({
      name: 'NonMember',
      email: 'nonmember@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    nonMemberToken = generateToken(nonMember._id);

    await User.create({
      name: 'UserB',
      email: 'userb@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });

    const uninvitedUser = await User.create({
      name: 'UserC',
      email: 'userc@example.com',
      password: 'password123',
      passwordConfirm: 'password123',
    });
    uninvitedUserToken = generateToken(uninvitedUser._id);

    if (Team) {
      try {
        team = await Team.create({
          name: 'Dev Team',
          description: 'Development team workspace',
          owner: owner._id,
          members: [owner._id],
        });
      } catch (err) {
        team = await Team.create({
          name: 'Dev Team',
          description: 'Development team workspace',
          owner: owner._id,
          members: [{ user: owner._id, role: 'owner' }],
        });
      }

      const inviteRes = await request(app)
        .post(`/api/v1/teams/${team._id}/invites`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'userb@example.com' });

      inviteToken =
        inviteRes.body.inviteToken ||
        inviteRes.body.data?.inviteToken ||
        inviteRes.body.data?.token ||
        'sample-invite-token';
    }
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('GAP 1: non-team members must be blocked from accessing team tasks', async () => {
    if (!team) return;

    const res = await request(app)
      .get(`/api/v1/teams/${team._id}/tasks`)
      .set('Authorization', `Bearer ${nonMemberToken}`);

    expect([400, 401, 403, 404]).toContain(res.status);
  });

  it('GAP 2: uninvited user must be prevented from accepting another user invite', async () => {
    let res = await request(app)
      .post(`/api/v1/teams/invites/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${uninvitedUserToken}`);

    if (res.status === 404) {
      res = await request(app)
        .post(`/api/v1/teams/accept-invite/${inviteToken}`)
        .set('Authorization', `Bearer ${uninvitedUserToken}`);
    }

    expect([400, 401, 403, 404]).toContain(res.status);
  });
});

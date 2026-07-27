const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const teamController = require('../Controllers/teamController');
const inviteController = require('../Controllers/inviteController');

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all teams for the authenticated user
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: List of teams belonging to the authenticated user
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.get('/', authController.protect, teamController.getAllTeams);

/**
 * @swagger
 * /teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Development Team
 *     responses:
 *       201:
 *         description: Team created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.post('/', authController.protect, teamController.createTeam);

/**
 * @swagger
 * /teams/invites:
 *   get:
 *     summary: Get all pending team invitations for the authenticated user
 *     tags: [Team Invitations]
 *     responses:
 *       200:
 *         description: List of team invitations
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.get('/invites', authController.protect, inviteController.getUserInvites);

/**
 * @swagger
 * /teams/invites/{inviteId}/accept:
 *   patch:
 *     summary: Accept a team invitation
 *     tags: [Team Invitations]
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Team invitation accepted successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Invitation not found
 */
router.patch('/invites/:inviteId/accept', authController.protect, inviteController.acceptInvite);

/**
 * @swagger
 * /teams/invites/{inviteId}/decline:
 *   patch:
 *     summary: Decline a team invitation
 *     tags: [Team Invitations]
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Team invitation declined successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Invitation not found
 */
router.patch('/invites/:inviteId/decline', authController.protect, inviteController.declineInvite);

/**
 * @swagger
 * /teams/{teamId}:
 *   get:
 *     summary: Get a specific team
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Team retrieved successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team not found or unauthorized
 */
router.get('/:teamId', authController.protect, teamController.getTeam);

/**
 * @swagger
 * /teams/{teamId}/tasks:
 *   post:
 *     summary: Create a task for a team
 *     tags: [Team Tasks]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Complete API documentation
 *               description:
 *                 type: string
 *                 example: Finish the Swagger documentation
 *     responses:
 *       201:
 *         description: Team task created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team not found or user is not a team member
 *
 *   get:
 *     summary: Get all tasks for a team
 *     tags: [Team Tasks]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: List of tasks belonging to the team
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team not found or user is not a team member
 */
router.post('/:teamId/tasks', authController.protect, teamController.createTaskForTeam);

router.get('/:teamId/tasks', authController.protect, teamController.getTasksForTeam);

/**
 * @swagger
 * /teams/{teamId}/tasks/{taskId}:
 *   patch:
 *     summary: Mark a team task as completed
 *     tags: [Team Tasks]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef654321
 *     responses:
 *       200:
 *         description: Team task completed successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team or task not found, or user is not a team member
 *
 *   get:
 *     summary: Get a specific team task
 *     tags: [Team Tasks]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef654321
 *     responses:
 *       200:
 *         description: Team task retrieved successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team or task not found, or user is not a team member
 */
router.patch('/:teamId/tasks/:taskId', authController.protect, teamController.completeTask);

router.get('/:teamId/tasks/:taskId', authController.protect, teamController.getTaskForTeam);

/**
 * @swagger
 * /teams/{teamId}/members/{memberId}:
 *   delete:
 *     summary: Remove a member from a team
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef654321
 *     responses:
 *       200:
 *         description: Team member removed successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team or member not found
 */
router.delete('/:teamId/members/:memberId', authController.protect, teamController.deleteMember);

/**
 * @swagger
 * /teams/{teamId}/invite:
 *   post:
 *     summary: Send an invitation to join a team
 *     tags: [Team Invitations]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *     responses:
 *       201:
 *         description: Team invitation sent successfully
 *       400:
 *         description: Validation error or user is already a team member
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Team or user not found
 */
router.post('/:teamId/invite', authController.protect, inviteController.sendInvite);

module.exports = router;

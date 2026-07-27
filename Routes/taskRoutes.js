const express = require('express');
const taskController = require('../Controllers/taskControllers');
const router = express.Router();
const authController = require('../Controllers/authController');

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks for the authenticated user
 *     tags: [Tasks]
 *     responses:
 *       200:
 *         description: List of all tasks belonging to the authenticated user
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.get('/', authController.protect, taskController.getAllTasks);

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
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
 *                 example: Finish backend project
 *               description:
 *                 type: string
 *                 example: Complete the API documentation and testing
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: 2026-08-01T12:00:00.000Z
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.post('/', authController.protect, taskController.createTask);

/**
 * @swagger
 * /tasks:
 *   delete:
 *     summary: Delete all unfinished tasks
 *     tags: [Tasks]
 *     responses:
 *       200:
 *         description: All unfinished tasks deleted successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.delete('/', authController.protect, taskController.deleteUnfinishedTask);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get a specific task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Task not found or unauthorized
 *
 *   patch:
 *     summary: Update a task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               title:
 *                 type: string
 *                 example: Finish Smart Task Manager
 *               description:
 *                 type: string
 *                 example: Complete Swagger documentation
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: 2026-08-10T12:00:00.000Z
 *               completed:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Task not found or unauthorized
 *
 *   delete:
 *     summary: Delete a specific task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f123456789abcdef123456
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 *       404:
 *         description: Task not found or unauthorized
 */
router.get('/:id', authController.protect, taskController.getTask);
router.patch('/:id', authController.protect, taskController.updateTask);
router.delete('/:id', authController.protect, taskController.deleteTask);

module.exports = router;

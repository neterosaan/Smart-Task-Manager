const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../Controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts from this IP, please try again in 15 minutes.',
});

/**
 * @swagger
 * /users/signup:
 *   post:
 *     summary: Create a new user account
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - passwordConfirm
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *               passwordConfirm:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/signup', authLimiter, authController.signup);

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login to the application
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123!
 *     responses:
 *       200:
 *         description: Login successful. An access token is returned and a refresh token is stored in an HttpOnly cookie.
 *       401:
 *         description: Incorrect email or password
 */
router.post('/login', authLimiter, authController.login);

/**
 * @swagger
 * /users/refresh-token:
 *   post:
 *     summary: Get a new access token using the refresh token
 *     tags: [Authentication]
 *     security: []
 *     description: The refresh token is automatically sent through an HttpOnly cookie.
 *     responses:
 *       200:
 *         description: New access token generated successfully
 *       401:
 *         description: Refresh token is missing, invalid, or expired
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /users/logout:
 *   post:
 *     summary: Logout the current user
 *     tags: [Authentication]
 *     security: []
 *     description: Clears the refresh token cookie and logs the user out.
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /users/forgotPassword:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Authentication]
 *     security: []
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
 *       200:
 *         description: Password reset email sent successfully
 *       404:
 *         description: User not found
 */
router.post('/forgotPassword', authLimiter, authController.forgotPassword);

/**
 * @swagger
 * /users/resetPassword/{token}:
 *   patch:
 *     summary: Reset user password
 *     tags: [Authentication]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
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
 *               - password
 *               - passwordConfirm
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *               passwordConfirm:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired reset token
 */
router.patch('/resetPassword/:token', authLimiter, authController.resetPassword);

router.use(authController.protect);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Current user retrieved successfully
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.get('/me', authController.getMe);

/**
 * @swagger
 * /users/updateMypassword:
 *   patch:
 *     summary: Update the authenticated user's password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passwordCurrent
 *               - password
 *               - passwordConfirm
 *             properties:
 *               passwordCurrent:
 *                 type: string
 *                 format: password
 *                 example: OldPassword123!
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *               passwordConfirm:
 *                 type: string
 *                 format: password
 *                 example: NewPassword123!
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Current password is incorrect or validation error
 *       401:
 *         description: Unauthorized - Access token is missing or invalid
 */
router.patch('/updateMypassword', authController.updatePassword);

module.exports = router;

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',

    info: {
      title: 'Smart Task Manager API',
      version: '1.0.0',
      description:
        'A backend API for task management with authentication, task recurrence, reminders, task archiving, completed tasks, activity logs, and team collaboration.',
    },

    servers: [
      { url: 'https://smart-task-manager-nq9l.onrender.com/api/v1/', description: 'Production' },
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Local',
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Enter your access token. The refresh token is stored in an HttpOnly cookie and is used to obtain a new access token.',
        },
      },
    },

    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  apis: ['./Routes/**/*Routes.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

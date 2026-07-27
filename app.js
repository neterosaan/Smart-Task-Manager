const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const taskRouter = require('./Routes/taskRoutes');
const userRouter = require('./Routes/userRoutes');
const teamRouter = require('./Routes/teamRoutes');
const globalErrorHandler = require('./Controllers/errorController');
const AppError = require('./utils/appError');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./config/swagger.js');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again in an hour.',
});

app.use('/api', generalLimiter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
  res.send('API is running');
});
app.use('/api/v1/tasks', taskRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/teams', teamRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
module.exports = app;

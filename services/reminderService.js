const cron = require('node-cron');
const Task = require('../models/taskModel');
const Email = require('../utils/email');
const catchAsync = require('../utils/catchAsync');
const ActivityLog = require('../models/activityLogModel');
const completedTaskModel = require('../models/completedTaskModel');
const { addDays, addMonths } = require('date-fns');

const sendEmailReminder = catchAsync(async () => {
  const now = Date.now();

  const tasks = await Task.find({
    $or: [
      { reminder: { $lte: now }, dontDistrub: false, recurrence: 'none' },
      { dueDate: { $lte: now }, status: 'Pending', recurrence: 'none' },
    ],
  }).populate('user');

  if (tasks.length === 0) return;

  for (const task of tasks) {
    let update = false;

    if (task.dueDate?.getTime() <= now && task.status === 'Pending') {
      task.status = 'Unfinished';
      update = true;
      await task.save({ validateBeforeSave: false });
    }

    if (!task.user || !task.user.email || task.status === 'Unfinished') continue;

    const url = `${process.env.FRONTEND_URL}/api/v1/tasks/${task.id}`;

    try {
      await new Email(task.user, url).sendEmailReminder();
      task.dontDistrub = true;
      update = true;
    } catch (err) {
      console.error(`Failed to send email to ${task.user.email}: ${err.message}`);
    }

    if (update) {
      await task.save({ validateBeforeSave: false });
    }
  }
});

const recurrenceLgocic = catchAsync(async () => {
  const now = Date.now();

  try {
    const tasks = await Task.find({
      recurrence: { $ne: 'none' },
      dueDate: { $lte: now },
      status: { $ne: 'Completed' },
    });

    for (const task of tasks) {
      await ActivityLog.create({
        user: task.user,
        task: task._id,
        actionType: 'task_missed',
      });

      const nextDueDate = getNextDueDate(task.dueDate, task.recurrence);
      task.dueDate = nextDueDate;
      task.createdAt = new Date();
      await task.save();
    }

    const completedTasks = await completedTaskModel.find({
      recurrence: { $ne: 'none' },
      dueDate: { $lte: now },
    });

    for (const completeTask of completedTasks) {
      const nextDueDate = getNextDueDate(completeTask.dueDate, completeTask.recurrence);

      await Task.create({
        title: completeTask.title,
        description: completeTask.description,
        status: 'Pending',
        priority: completeTask.priority,
        dueDate: nextDueDate,
        recurrence: completeTask.recurrence,
        user: completeTask.user,
        category: completeTask.category,
        tags: completeTask.tags,
      });
      completeTask.dueDate = nextDueDate;
      await completeTask.save();
    }
  } catch (err) {
    console.error('Error in task cron job:', err);
  }
});

function getNextDueDate(currentDueDate, recurrence) {
  const now = new Date(currentDueDate);

  switch (recurrence) {
    case 'daily':
      return addDays(now, 1);
    case 'weekly':
      return addDays(now, 7);
    case 'monthly':
      return addMonths(now, 1);
    default:
      return now;
  }
}

const startReminderCron = () => {
  cron.schedule('* * * * *', recurrenceLgocic);
  cron.schedule('* * * * *', sendEmailReminder);
};

module.exports = { startReminderCron, sendEmailReminder, recurrenceLgocic };

/*const completedTasks = await completedTaskModel.find({
            recurrence: { $ne: 'none' },
            status: { $ne: 'Completed' }
        })*/

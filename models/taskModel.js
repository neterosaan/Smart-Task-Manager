const mongoose = require('mongoose');
const validator = require('validator');
const { addDays, addMonths } = require('date-fns');
const CompletedTask = require('./completedTaskModel');
const ActivityLog = require('./activityLogModel');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 30,
    minlength: 2,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Unfinished'],
    default: 'Pending',
  },

  priority: {
    type: String,
    required: true,
    enum: ['High', 'Mid', 'Low'],
    default: 'Mid',
  },
  dueDate: {
    type: Date,
    required: [
      function () {
        return this.recurrence === 'none';
      },
      'Due date is required when recurrence is none',
    ],
  },
  reminder: {
    type: Date,
    immutable: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  category: {
    type: String,
    enum: ['Personal', 'Work', 'Shopping', 'Other'],
    default: 'Personal',
  },

  recurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none',
  },

  tags: {
    type: [String],
    default: [],
  },

  dontDistrub: {
    type: Boolean,
    default: false,
  },
});

taskSchema.index({ user: 1, title: 1 }, { unique: true });

taskSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('recurrence')) {
    const now = new Date();

    if (this.recurrence !== 'none') {
      switch (this.recurrence) {
        case 'daily':
          this.dueDate = addDays(now, 1); // Adds 1 day
          break;
        case 'weekly':
          this.dueDate = addDays(now, 7); // Adds 7 days
          break;
        case 'monthly':
          this.dueDate = addMonths(now, 1); // Adds 1 month
          break;
        default:
          break;
      }
    }
  }
  next();
});

taskSchema.pre('save', function (next) {
  if (this.isModified('dueDate') && this.recurrence === 'none') {
    this.reminder = new Date(this.createdAt.getTime() + (this.dueDate - this.createdAt) / 4);
  } else {
    this.reminder = undefined;
  }
  next();
});

taskSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.dueDate) {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate && docToUpdate.recurrence === 'none') {
      update.reminder = new Date(
        docToUpdate.createdAt.getTime() + (update.dueDate - docToUpdate.createdAt) / 4
      );
    } else {
      update.reminder = undefined;
    }
  }
  next();
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;

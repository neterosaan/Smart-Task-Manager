const mongoose = require('mongoose');
const ActivityLog = require('./activityLogModel');
const completedTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  originalTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  description: { type: String },
  dueDate: { type: Date },
  priority: { type: String, enum: ['Low', 'Mid', 'High'], default: 'Mid' },
  category: {
    type: String,
    enum: ['Personal', 'Work', 'Shopping', 'Other'],
    default: 'Personal',
  },
  tags: { type: [String], default: [] },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: Date.now },
  recurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
  },
});

completedTaskSchema.pre('save', async function (next) {
  await ActivityLog.create({
    user: this.user,
    task: this.originalTask,
    actionType: 'task_completed',
  });
  next();
});

const CompletedTask = mongoose.model('CompletedTask', completedTaskSchema);
module.exports = CompletedTask;

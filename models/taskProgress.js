const mongoose = require('mongoose');



const taskProgressSchema = new mongoose.Schema({
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  });


  taskProgressSchema.pre('save', function (next) {
    if (this.isModified('status')) {
      this.updatedAt = Date.now();
    }
    next();
  });
  
  const TaskProgress = mongoose.model('TaskProgress', taskProgressSchema);
  module.exports = TaskProgress;
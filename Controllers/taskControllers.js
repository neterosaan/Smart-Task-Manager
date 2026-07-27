const Task = require("../models/taskModel");
const CompletedTask = require("../models/completedTaskModel");
const catchAsync = require("../utils/catchAsync");
const ActivityLog = require("../models/activityLogModel");
const APIFeatures = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const Team = require("../models/teamModel");

exports.createTask = catchAsync(async (req, res, next) => {
  const { teamId, ...taskData } = req.body;

  if (teamId) {
    return next(
      new AppError("You cannot assign a team to a personal task", 400),
    );
  }

  taskData.user = req.user.id;

  const task = await Task.create(taskData);

  await ActivityLog.create({
    user: req.user.id,
    task: task._id,
    actionType: "task_created",
  });

  res.status(201).json({
    status: "success",
    data: {
      task,
    },
  });
});

exports.getAllTasks = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  let filter = { user: userId };

  const features = new APIFeatures(Task.find(filter), req.query)
    .search()
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const doc = await features.query;

  res.status(200).json({
    status: "success",
    results: doc.length,
    data: {
      data: doc,
    },
  });
});

exports.getTask = catchAsync(async (req, res, next) => {
  const userId = req.user.id;


  const task = await Task.findOne({
    _id: req.params.id,
    user: userId, 
  });

  if (!task) {
    return next(new AppError("No document found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      data: task,
    },
  });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const task = await Task.findOne({
    _id: req.params.id,
    user: userId, 
  });

  if (!task) {
    return next(new AppError("No document found with that ID", 404));
  }

  await ActivityLog.create({
    user: req.user.id,
    task: task._id,
    actionType: "task_deleted",
  });

  await task.deleteOne();

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.updateTask = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const task = await Task.findOne({
    _id: req.params.id,
    user: userId, 
  });

  if (!task) {
    return next(new AppError("No document found with that ID", 404));
  }

  if (req.body.status === "Completed" && task.status !== "Completed") {
    const completedTask = await CompletedTask.create({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      category: task.category,
      tags: task.tags,
      user: task.user,
      recurrence: task.recurrence,
      completedAt: Date.now(),
      originalTask: task._id,
    });

    await task.deleteOne();

    return res.status(200).json({
      status: "success",
      data: {
        task: completedTask,
      },
    });
  }

  const allowedFields = [
    "title",
    "description",
    "status",
    "priority",
    "dueDate",
    "category",
    "recurrence",
    "tags",
    "dontDistrub",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      task[field] = req.body[field];
    }
  });
  await task.save(); 

  res.status(200).json({
    status: "success",
    data: {
      task,
    },
  });
});

exports.deleteUnfinishedTask = catchAsync(async (req, res, next) => {
  const tasks = await Task.find({ user: req.user.id, status: "Unfinished" });

  if (tasks.length === 0) {
    return next(new AppError("No unfinished tasks found to delete.", 404));
  }

  for (let task of tasks) {
    await ActivityLog.create({
      user: req.user.id,
      task: task._id,
      actionType: "task_deleted",
    });
  }

  await Task.deleteMany({ user: req.user.id, status: "Unfinished" });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

const Team = require("../models/teamModel");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const appError = require("../utils/appError");
const ActivityLog = require("../models/activityLogModel");
const APIFeatures = require("../utils/apiFeatures");
const Task = require("../models/taskModel");
const TaskProgress = require("../models/taskProgress");

exports.createTeam = catchAsync(async (req, res, next) => {
  req.body.owner = req.user.id;

  const team = await Team.create(req.body);

  await ActivityLog.create({
    user: req.user.id,
    actionType: "team_created",
  });

  res.status(201).json({
    status: "success",
    team,
  });
});

exports.getAllTeams = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const filter = {
    $or: [{ owner: userId }, { members: userId }],
  };

  const features = new APIFeatures(Team.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const teams = await features.query;

  if (!teams || teams.length === 0) {
    return next(new appError("No teams found for this user.", 404));
  }

  res.status(200).json({
    status: "success",
    results: teams.length,
    data: {
      teams,
    },
  });
});

exports.getTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.teamId).populate("owner members");

  if (!team) {
    return next(new appError("no team found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      data: team,
    },
  });
});

exports.deleteMember = catchAsync(async (req, res, next) => {
  const { teamId, memberId } = req.params;

  const team = await Team.findById(teamId);

  if (!team) {
    return next(new appError("no team found with that ID", 404));
  }

  if (team.owner.toString() !== req.user.id) {
    return next(new appError("You are not authorized to delete a member", 403)); 
  }

  if (!team.members.some((id) => id.equals(memberId))) {
    return next(new appError("User is not a member of this team", 400));
  }

  await Team.findByIdAndUpdate(teamId, {
    $pull: { members: memberId },
  });

  res.status(200).json({
    status: "success",
    message: "User successfully removed from the team.",
  });
});

exports.createTaskForTeam = catchAsync(async (req, res, next) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId);
  if (!team) return next(new appError("Team not found", 404));

  if (team.owner.toString() !== req.user.id) {
    return next(
      new appError("Only the team owner can create tasks for this team", 403),
    );
  }

  req.body.team = teamId;
  req.body.user = req.user.id;

  const task = await Task.create(req.body);

  const users = [team.owner, ...team.members];

  const progressDocs = users.map((userId) => ({
    task: task._id,
    user: userId,
  }));

  await TaskProgress.insertMany(progressDocs);

  res.status(201).json({
    status: "success",
    data: {
      task,
    },
  });
});

exports.getTasksForTeam = catchAsync(async (req, res, next) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId);
  if (!team) {
    return next(new appError("Team not found", 404));
  }

  const isOwner = team.owner.toString() === req.user.id;
  const isMember = team.members.some((id) => id.equals(req.user._id));

  if (!isOwner && !isMember) {
    return next(new appError("You are not a member of this team", 403));
  }

  const tasks = await TaskProgress.find({ user: req.user.id }).populate({
    path: "task",
    match: { team: teamId },
  });

  res.status(200).json({
    status: "success",
    results: tasks.length,
    data: {
      tasks,
    },
  });
});

exports.getTaskForTeam = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;

  const task = await TaskProgress.findOne({
    task: taskId,
    user: req.user.id,
  }).populate("task");
  if (!task) {
    return next(new appError("Task not found for this team", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      task,
    },
  });
});




exports.completeTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;

  const taskProgress = await TaskProgress.findOne({
    task: taskId,
    user: req.user.id,
  });

  if (!taskProgress) {
    return next(new appError("Task progress not found for this user", 404));
  }

  if (taskProgress.status === "Completed") {
    return next(new appError("Task is already completed", 400));
  }

  taskProgress.status = "Completed";

  taskProgress.updatedAt = Date.now();

  await taskProgress.save();

  res.status(200).json({
    status: "success",
    data: {
      taskProgress,
    },
  });
});

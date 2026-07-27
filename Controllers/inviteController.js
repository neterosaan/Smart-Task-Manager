const Invite = require("../models/inviteModel");
const User = require("../models/userModel");
const Team = require("../models/teamModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.sendInvite = catchAsync(async (req, res, next) => {
  const teamId = req.params.teamId;
  const username = req.body.username;
  const team = await Team.findById(teamId);

  if (!team) return next(new AppError("Team not found", 404));

  if (team.owner.toString() !== req.user.id) {
    return next(new AppError("Only the team owner can send invites", 403));
  }

  const user = await User.findOne({ name: username });

  if (!user) return next(new AppError("User not found", 404));

  if (team.members.some((memberId) => memberId.equals(user._id))) {
    return next(new AppError("User is already a member", 400));
  }
  const invite = await Invite.create({
    team: teamId,
    user: user._id,
    status: "pending",
    invitedBy: req.user.id,
  });

  const populatedInvite = await invite.populate("team user invitedBy");

  res.status(201).json({
    status: "success",
    message: "Invite sent successfully!",
    populatedInvite,
  });
});

exports.getUserInvites = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const invites = await Invite.find({
    user: userId,
    status: "pending",
  }).populate("team invitedBy");

  if (!invites) return next(new AppError("No invites found", 404));

  res.status(200).json({
    status: "success",
    data: {
      invites,
    },
  });
});

exports.acceptInvite = catchAsync(async (req, res, next) => {
  const inviteId = req.params.inviteId;
  const userId = req.user.id;

  const invite = await Invite.findById(inviteId);
  if (!invite) return next(new AppError("Invite not found", 404));

  if (invite.user.toString() !== userId)
    return next(
      new AppError("You are not authorized to accept this invite", 403),
    );

  if (invite.status !== "pending")
    return next(new AppError("This invite has already been responded to", 400));

  const team = await Team.findById(invite.team);
  if (!team) return next(new AppError("Team not found", 404));

  if (!team.members.some((id) => id.equals(userId))) {
    team.members.push(userId);
    await team.save();
  }

  invite.status = "accepted";
  await invite.save();

  res.status(200).json({
    status: "success",
    message: "Invite accepted and added to the team.",
  });
});

exports.declineInvite = catchAsync(async (req, res, next) => {
  const inviteId = req.params.inviteId;
  const userId = req.user.id; 

  const invite = await Invite.findById(inviteId);
  if (!invite) return next(new AppError("Invite not found", 404));

  if (invite.user.toString() !== userId)
    return next(
      new AppError("You are not authorized to decline this invite", 403),
    );

  if (invite.status !== "pending")
    return next(new AppError("This invite has already been responded to", 400));

  invite.status = "declined";
  await invite.save();

  res.status(200).json({
    status: "success",
    message: "Invite declined successfully",
  });
});

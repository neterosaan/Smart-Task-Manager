const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Email = require("../utils/email");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const crypto = require("crypto");
const { promisify } = require("util");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createAndStoreRefreshToken = async (user) => {
  const refreshToken = crypto.randomBytes(32).toString("hex");

  user.refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const expiresInDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10);
  user.refreshTokenExpires = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  );

  await user.save({ validateBeforeSave: false });

  return refreshToken;
};

const createSendTokens = async (user, statusCode, res) => {
  const accessToken = signToken(user._id);
  const refreshToken = await createAndStoreRefreshToken(user);

  const expiresInDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 10);
  res.cookie("refreshToken", refreshToken, {
    expires: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "strict",
  });

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    accessToken,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: undefined,
  });
  const url = `${req.protocol}://${req.get("host")}/me`;
await new Email(newUser, url).sendWelcome();
await createSendTokens(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Incorrect email or password!", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password!", 401));
  }
  await createSendTokens(user, 200, res);
});

exports.getMe = (req, res) => {
  res.status(200).json({
    status: "success",
    data: {
      user: req.user, 
    },
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new AppError("You are not logged in! please log in to get acess", 401),
    );
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const freshUser = await User.findById(decoded.id);

  if (!freshUser) {
    return next(
      new AppError(
        "the user belongin to this token does no longer exist.",
        401,
      ),
    );
  }

  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! please log in again", 401),
    );
  }

  req.user = freshUser;

  next();
});

exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return next(
      new AppError("No refresh token found. Please log in again.", 401),
    );
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const user = await User.findOne({
    refreshTokenHash: hashedToken,
    refreshTokenExpires: { $gt: Date.now() },
  }).select("+refreshTokenHash +refreshTokenExpires");

  if (!user) {
    res.clearCookie("refreshToken");
    return next(
      new AppError(
        "Invalid or expired refresh token. Please log in again.",
        401,
      ),
    );
  }

  const accessToken = signToken(user._id);

  res.status(200).json({
    status: "success",
    accessToken,
  });
});

exports.logout = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await User.findOneAndUpdate(
      { refreshTokenHash: hashedToken },
      { refreshTokenHash: undefined, refreshTokenExpires: undefined },
    );
  }

  res.clearCookie("refreshToken");
  res.status(200).json({
    status: "success",
    message: "Logged out successfully.",
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError("There is no user with email adress.", 404));
  }

  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  try {
    const resetURL = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();
    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email. Try again later!",
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetExpires: { $gt: Date.now() },
    passwordResetToken: hashedToken,
  });

  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;
  user.passwordChangedAt = Date.now() - 1000;
  await user.save();

  await createSendTokens(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current Password is wrong.", 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordChangedAt = Date.now() - 1000;
  await user.save();

  await createSendTokens(user, 200, res);
});

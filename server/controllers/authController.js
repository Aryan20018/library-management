import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { User } from "../models/user.Model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationCode } from "../utils/sendVerificationCode.js";
import { sendToken } from "../utils/sendToken.js";
import { sendEmail } from "../utils/sendEmail.js";
import { generateForgotPasswordEmailTemplate } from "../utils/emailTemplates.js";

// register
export const register = catchAsyncError(async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return next(new ErrorHandler("Please enter all fields", 400));
    }
    const isRegistered = await User.findOne({ email, accountVerified: true });
    if (isRegistered) {
      return next(new ErrorHandler("User already registered", 400));
    }
    const registerationAttemptsByUser = await User.find({
      email,
      accountVerified: false,
    });
    if (registerationAttemptsByUser.length >= 6) {
      return next(
        new ErrorHandler(
          "You have exceeded the maximum number of registration attempts. Please contact support.",
          400
        )
      );
    }
    if (password.length < 8 || password.length > 20) {
      return next(
        new ErrorHandler("Password must be between 8 and 20 characters", 400)
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    const verificationCode = await user.generateVerificationCode();
    await user.save();
    sendVerificationCode(verificationCode, email, res);
  } catch (error) {
    next(error);
  }
});

//otp verify

export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return next(new ErrorHandler("Email otp is missing.", 400));
  }
  try {
    const userAllEntries = await User.find({
      email,
      accountVerified: false,
    }).sort({ createdAt: -1 });

    if (!userAllEntries) {
      return next(new ErrorHandler("User not found.", 404));
    }
    let user;
    if (userAllEntries.length > 1) {
      user = userAllEntries[0];
      await User.deleteMany({
        _id: { $ne: user._id },
        email,
        accountVerified: false,
      });
    } else {
      user = userAllEntries[0];
    }
    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Ivalid OTP.", 400));
    }
    const currentTime = Date.now();

    const verificationCodeExpire = new Date(
      user.verificationCodeExpire
    ).getTime();

    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP expired", 400));
    }

    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account Verified", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error", 500));
  }
});

// login

export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return next(new ErrorHandler("Please enter all fields.", 400));
  }
  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );
  if (!user) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }
  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }
  sendToken(user, 200, "User login successfully.", res);
});

//logout

export const logout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logout successfully.",
    });
});

//get user
export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

//password forgot
export const forgetPassword = catchAsyncError(async (req, res, next) => {
  if (!req.body.email) {
    return next(new ErrorHandler("Email is required", 400));
  }
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(new ErrorHandler("Invalid email.", 400));
  }
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  const resetPasswordUrl = `${process.env.FORNTEND_URL}/password/reset/${resetToken}`;
  const message = generateForgotPasswordEmailTemplate(resetPasswordUrl);

  try {
    await sendEmail({
      email: user.email,
      subject: "Library Management password recovery",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resestPasswordToken = undefined;
    user.resestPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message, 500));
  }
});

export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  // console.log(token);

  const resestPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  // console.log("196");
  //
  //

  const user = await User.findOne({
    resestPasswordToken,
    resestPasswordExpire: { $gt: Date.now() },
  });
  // console.log(resestPasswordToken);
  // console.log(resestPasswordExpire);

  if (!user) {
    return ErrorHandler(
      "Reset password token is invaild or has been expried",
      400
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(
      new ErrorHandler("Password & confirm pasword donot match", 400)
    );
  }
  if (
    req.body.password.length < 8 ||
    req.body.password.length > 20 ||
    req.body.confirmPassword.length < 8 ||
    req.body.confirmPassword.length > 20
  ) {
    return next(
      new ErrorHandler("Password must be between 8 & 20 characters", 400)
    );
  }
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  user.password = hashedPassword;
  user.resestPasswordToken = undefined;
  user.resestPasswordExpire - undefined;

  await user.save();

  sendToken(user, 200, "password reset succesfully", res);
});

export const updatePassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user_id).select("+password");
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return next(new ErrorHandler("Please enter all Fields.", 400));
  }
  const isPasswordMatched = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!isPasswordMatched) {
    return next(new ErrorHandler("current password is incorrect.", 400));
  }
  if (
    newPassword.length < 8 ||
    newPassword.length > 20 ||
    confirmNewPassword.length < 8 ||
    confirmNewPassword.length > 20
  ) {
    return next(
      new ErrorHandler("Password must be between 8 & 20 characters", 400)
    );
  }
  if (newPassword !== confirmNewPassword) {
    return next(
      new ErrorHandler("New Password and Confirm New Password do not match", 400),
    );
  }
  const hashedPassword = await bcrypt.hash(newPassword,10);
  user.password = hashedPassword;
  await user.save();
  res.status(200).json({
    success:true,
    message:"Password updated",
  });
});

import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { User } from "../models/user.Model.js";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";

export const getAllUser = catchAsyncError(async (req, res, next) => {
  const user = await User.find({ accountVerified: true });
  res.status(200).json({
    success: true,
    user,
  });
});

export const registerNewAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Admin avatar is required", 400));
  }
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please fill all fields", 400));
  }
  const isRegistered = await User.findOne({ email, accountVerified: true });
  if (isRegistered) {
    return next(new ErrorHandler("User already registered", 400));
  }
  if (password.length < 8 || password.length > 16) {
    return next(
      new ErrorHandler("Password must be between 8 and 20 characters", 400)
    );
  }

  const { avatar } = req.files;
  const allowedFormats = ["image/png", "image/jpg", "image/webg"];

  if (!allowedFormats.includes(avatar.mimetype)) {
    return next(new ErrorHandler("File format not supported", 400));
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const cloudinaryResponse = await cloudinary.uploader.upload(
    avatar.tempFilePath,
    {
      folder: "LIBRARY_MANAGEMENT_SYSTEM",
    }
  );
  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error(
      "Cloudinary error:",
      cloudinaryResponse.error || "Unknown cloudiary error."
    );
    return next(
      new ErrorHandler("Failed to upload Avatar image to cloundinary", 500)
    );
}
    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "Admin",
      accountVerified: true,
      avatar: {
        public_id: cloudinaryResponse.public_id,
        url: cloudinaryResponse.secure_url,
      },
    });
    res.status(201).json({
        success:true,
        message:"Admin registerd Successfully",
        admin,
    })
  
});

import { catchAsyncError } from "../middlewares/catchAsyncError";
import{Book} from "../models/bookModel"
import{User} from "../models/user.Model"
import ErrorHandler from "../middlewares/errorMiddlewares.js"
// import express from "express";

export const addBook = catchAsyncError(async (req,res,next) => { });
export const deleteBook = catchAsyncError(async (req,res,next) => { });
export const getAllBook = catchAsyncError(async (req,res,next) => { });

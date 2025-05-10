import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { Borrow } from "../models/borrowModel.js";
import { Book } from "../models/bookModel.js";
import { User } from "../models/user.Model.js";
import { calculateFine } from "../utils/fineCalculate.js";

export const recordBorrowedBook = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { email } = req.body;
  // console.log("124");

  const book = await Book.findById(id);
  // console.log(book);
  if (!book) {
    // console.log("12");

    return next(new ErrorHandler("Book not found", 404));
  }

  const user = await User.findOne({
    email,
    role: "User",
    accountVerified: true,
  });

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  if (book.quantity === 0) {
    return next(new ErrorHandler("Book not available.", 404));
  }
  // console.log("45");
  const isAlreadyBorrowed = user.borrowedBooks.find(
    (b) => b.bookId.toString() === id && b.returned === false
  );
  // console.log("5");
  if (isAlreadyBorrowed) {
    return next(new ErrorHandler("Book already borrowrd.", 400));
  }
  book.quantity -= 1;
  book.availability = book.quantity > 0;
  await book.save();

  user.borrowedBooks.push({
    bookId: book._id,
    bookTitle: book.title,
    borrowedDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await user.save();
  await Borrow.create({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
    book: book._id,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    price: book.price,
  });
  res.status(200).json({
    success: true,
    message: "Borrowed book recorded successfully.",
  });
});
export const returnBorrowBook = catchAsyncError(async (req, res, next) => {
  const { bookId } = req.params;
  const { email } = req.body;
  
  console.log("run1");

  const book = await Book.findById(bookId);
  if (!book) {
    return next(new ErrorHandler("Book not found", 404));
  }
  // try {
  //   const book = await Book.findById(bookId);
  //   if (!book) {
  //     return next(new ErrorHandler("Book not found", 404));
  //   }
  //   // ...
  // } catch (err) {
  //   return next(new ErrorHandler("Invalid book ID", 400));
  // }
  

  const user = await User.findOne({ email, accountVerified: true });
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }


  const borrowedBooks = user.borrowedBooks.find(
    (b) => b.bookId.toString() === bookId && b.returned === false
  );
  if (!borrowedBooks) {
    return next(new ErrorHandler("You have not borrowed this book", 400));
  }
  borrowedBooks.returned = true;
  await user.save();

  book.quantity += 1;
  book.availability = book.quantity > 0;
  await book.save();

  const borrow = await Borrow.findOne({
    book: bookId,
    "user.email": email,
    returnDate: null,
  });
  if (!borrow) {
    return next(new ErrorHandler("Book not borrowed", 400));
  }
  borrow.returnDate = new Date();

  const fine = calculateFine(borrow.dueDate);
  borrow.fine = fine;
  await borrow.save();
  res.status(200).json({
    success: true,
    message:
      fine !== 0
        ? `The book has been successfully. The total charges,including a fine , are $${
            fine + book.price
          } `
        : `The book has been successfully. The total charges are $ ${book.price}`,
  });
});

export const borrowedBooks = catchAsyncError(async (req, res, next) => {
  const { borrowedBooks } = req.user;
  res.status(200).json({
    success: true,
    borrowedBooks,
  });
});

export const getBorrowedBooksForAdmin = catchAsyncError(
  async (req, res, next) => {
    const  borrowedBooks = await Borrow.find();
    res.status(200).json({
      success: true,
      borrowedBooks,
    });
  }
);

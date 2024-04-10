const router = require("express")()
const { BookModel } = require("../models/book")
const { UserModel } = require("../models/user")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const omitPassword = (user) => {
  const { password, ...rest } = user
  return rest
}

router.get("/", async (req, res, next) => {
  try {
    const users = await UserModel.find({})
    return res.status(200).json({ users: users.map((user) => user) })
  } catch (err) {
    next(err)
  }
})

router.post("/borrow", async (req, res, next) => {
  try {
    const book = await BookModel.findOne({ isbn: req.body.isbn })
    if (book == null) {
      return res.status(404).json({ error: "Book not found" })
    }
    if (book.borrowedBy.length === book.quantity) {
      return res.status(400).json({ error: "Book is not available" })
    }
    const user = await UserModel.findById(req.body.userId)
    if (user == null) {
      return res.status(404).json({ error: "User not found" })
    }
    if (book.borrowedBy.includes(user.id)) {
      return res.status(400).json({ error: "You've already borrowed this book" })
    }
    await book.update({ borrowedBy: [...book.borrowedBy, user.id] })
    const updatedBook = await BookModel.findById(book.id)
    return res.status(200).json({
      book: {
        ...updatedBook.toJSON(),
        availableQuantity: updatedBook.quantity - updatedBook.borrowedBy.length,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post("/return", async (req, res, next) => {
  try {
    const book = await BookModel.findOne({ isbn: req.body.isbn })
    if (book == null) {
      return res.status(404).json({ error: "Book not found" })
    }
    const user = await UserModel.findById(req.body.userId)
    if (user == null) {
      return res.status(404).json({ error: "User not found" })
    }
    if (!book.borrowedBy.includes(user.id)) {
      return res.status(400).json({ error: "You need to borrow this book first!" })
    }
    console.log("user.id", user.id)
    console.log("book.borrowedBy", book.borrowedBy)
    console.log(
      "filtered",
      book.borrowedBy.filter((borrowedBy) => !borrowedBy.equals(user.id))
    )
    await book.update({
      borrowedBy: book.borrowedBy.filter((borrowedBy) => !borrowedBy.equals(user.id)),
    })
    const updatedBook = await BookModel.findById(book.id)
    return res.status(200).json({
      book: {
        ...updatedBook.toJSON(),
        availableQuantity: updatedBook.quantity - updatedBook.borrowedBy.length,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get("/borrowed-books", async (req, res, next) => {
  try {
    const result = await BookModel.find({ "borrowedBy": { "$in": req.session.userId } })
    return res.status(200).json({ books: result })
  } catch (err) {
    next(err)
  }
})

router.get("/profile", async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.session.userId)
    if (user == null) {
      return res.status(404).json({ error: "User not found" })
    }
    return res.status(200).json({ user: user })
  } catch (err) {
    next(err)
  }
})

// User registration
router.post('/register', async(req, res) => {
  req.body.role = "guest"
  try {
      const { username, password, role } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new UserModel({ username, password: hashedPassword, role });
      await user.save();
      res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
      res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
router.post('/login', async(req, res) => {
  try {
      const { username, password } = req.body;
      const user = await UserModel.findOne({ username });
      if (!user) {
          return res.status(401).json({ error: 'Authentication failed' });
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
          return res.status(401).json({ error: 'Authentication failed' });
      }
      const token = jwt.sign({ userId: user._id }, 'your-secret-key', {
          expiresIn: '1h',
      });
      console.log("user.id", user.id)
      req.session.userId = user.id
      res.status(200).json({ user, token });
  } catch (error) {
      res.status(500).json({ error: 'Login failed' });
  }
});

/* router.post("/login", async (req, res, next) => {
  try {
    const user = await UserModel.findOne({ username: req.body.username })
    if (user == null) {
      return res.status(404).json({ error: "User not found" })
    }
    if (user.password !== req.body.password) {
      return res.status(400).json({ error: "Invalid password" })
    }
    console.log("user.id", user.id)
    req.session.userId = user.id
    return res.status(200).json({ user: omitPassword(user.toJSON()) })
  } catch (err) {
    next(err)
  }
}) */

router.get("/logout", (req, res) => {
  req.session.destroy()
  return res.status(200).json({ success: true })
})

module.exports = { router }

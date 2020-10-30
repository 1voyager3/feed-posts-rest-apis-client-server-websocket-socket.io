const express = require('express');
const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');
const mongoose = require('mongoose');
const path = require('path');
// to be able parse incoming request bodies
const bodyParser = require('body-parser');
const multer = require('multer');

// execution express
const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, `${new Date().toISOString()}-${file.originalname}`);
  }
});
const fileFilter = (req, file, cb) => {
  if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// it used for x-www-form-urlencoded request for the <form>
// app.use(bodyParser.urlencoded());

// it used for parsing json data incoming requests
// Content-Type: application/json;
app.use(bodyParser.json());

app.use(
    multer({
      storage: fileStorage,
      fileFilter: fileFilter
    })
        .single('image')
);

app.use('/images', express.static(path.join(__dirname, 'images')));

// to provide access to the Client/browser to avoid CORS errors
// value "*" allows access to any browsers or set particular domain
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // call next the request to be able to continue and use next middleware in our case:
  // app.use('/feed', feedRoutes);
  next();
});

// to be able to forward any http methods, it filters in routes files,
// to forward any incoming request to feedRoutes
// or to forward any incoming request which starting with '/feed'
app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

// registration error middleware
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;

  const data = error.data;
  res.status(status)
      .json({ message: message, data: data });

});

// initializing database
mongoose
    .connect(
        // put appropriate mongodb url
        ''
    )
    .then(() => {
      const server = app.listen(8080);

      // initializing websocket
      const io = require('./socket').init(server);

      // socket is a client-side, it establish connection between server-side and client-side
      io.on('connection', socket => {
        console.log('Client connected');
      });

      console.log('Server CONNECTED!');
    })
    .catch(err => {
      console.log(err);
    });

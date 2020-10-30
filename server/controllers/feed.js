const { validationResult } = require('express-validator');
const Post = require('../models/post');
const User = require('../models/user');
const fs = require('fs');
const path = require('path');
const io = require('../socket');

exports.getPosts = async (req, res, next) => {

  // pagination
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {

    const totalItems = await Post.find()
        // countDocument indicates how many documents/items are have
        .countDocuments();

    // finding from db
    const posts = await Post.find()
        .populate('creator')
        // sort in descending way
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * perPage)
        .limit(perPage);

    res.status(200)
        .json({
          message: 'Fetched posts successfully.',
          posts: posts,
          totalItems: totalItems
        });

  } catch (err) {

    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);

  }

};

exports.createPost = async (req, res, next) => {

  const errors = validationResult(req);

  if (!errors.isEmpty()) {

    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;

  }

  // access to upload file
  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path;

  // parsing data
  const title = req.body.title;
  const content = req.body.content;

  // Create post in db
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  });

  try {

    await post.save();

    const user = await User.findById(req.userId);

    user.posts.push(post);

    await user.save();

    // emit() socket.io method sends the message to all connected users
    // broadcast() socket.io method sends the message to all connected users, except for
    // the one from which this request was sent
    io.getIO()
        // posts is arbitrary name of event to use it in frontend app, in our case
        // on client-side in src/pages/feed/feed.js, ---> socket.on('posts')
        .emit('posts', {
          action: 'create',
          // "...post._doc" passes all the data about the post
          post: {
            ...post._doc,
            creator: {
              _id: req.userId,
              name: user.name
            }
          }
        });

    res.status(201)
        .json({
          message: 'Post created successfully',
          post: post,
          creator: {
            _id: user._id,
            name: user.name
          }
        });

  } catch (err) {

    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);

  }

};

exports.getPost = async (req, res, next) => {

  // req.params.postId === router.get('/post/:postId')
  const postId = req.params.postId;

  try {

    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error('Could not find post');
      error.statusCode = 404;
      // end up in catch block next(err)
      throw error;
    }

    res.status(200)
        .json({
          message: 'Post fetched',
          post: post
        });

  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {

  const postId = req.params.postId;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {

    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;

  }

  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path;
  }
  if (!imageUrl) {
    const error = new Error('No file picked.');
    error.statusCode = 422;
    throw error;
  }

  try {

    const post = await Post.findById(postId)
        .populate('creator');

    if (!post) {
      const error = new Error('Could not find post');
      error.statusCode = 404;
      // end up in catch block next(err)
      throw error;
    }

    if (post.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized');
      error.statusCode = 403;
      throw error;
    }

    // trigger to clear old image
    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.imageUrl = imageUrl;
    post.content = content;

    const result = await post.save();

    io.getIO()
        .emit('posts', {
          action: 'update',
          post: result
        });

    res.status(200)
        .json({
          message: 'Post updated',
          post: result
        });

  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }

};

exports.deletePost = async (req, res, next) => {

  const postId = req.params.postId;

  try {

    const post = await Post.findById(postId);

    if (!post) {
      const error = new Error('Could not find post');
      error.statusCode = 404;
      // end up in catch block next(err)
      throw error;
    }

    if (post.creator.toString() !== req.userId) {
      const error = new Error('Not authorized');
      error.statusCode = 403;
      throw error;
    }

    clearImage(post.imageUrl);

    await Post.findByIdAndRemove(postId);

    const user = await User.findById(req.userId);

    // to remove post from the user
    user.posts.pull(postId);

    await user.save();

    io.getIO()
        .emit('posts', {
          action: 'delete', post: postId
        });

    res.status(200)
        .json({ message: 'Deleted post.' });

  } catch (err) {

    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// helper function for clearing old image
const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.log(err));
};












var express = require('express');
var router = express.Router();
const userModel = require('./users');
const passport = require('passport');

router.get('/', function(req, res) {
  res.render('index', { errors: req.flash('error') });
});

router.get('/profile', isLoggedIn, function(req, res) {
  res.render('profile', { user: req.user });
});

router.post('/register', async function(req, res, next) {
  const { username, password, secret } = req.body;

  if (typeof username !== 'string' || !username.trim() ||
      typeof password !== 'string' || !password ||
      (secret !== undefined && typeof secret !== 'string')) {
    req.flash('error', 'Enter a username and password.');
    return res.redirect('/');
  }

  try {
    const user = await userModel.register(new userModel({
      username: username.trim(),
      secret: secret
    }), password);

    req.logIn(user, function(err) {
      if (err) return next(err);
      res.redirect('/profile');
    });
  } catch (err) {
    if (err.name === 'UserExistsError' || err.code === 11000) {
      req.flash('error', 'That username is already registered.');
      return res.redirect('/');
    }
    next(err);
  }
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/',
  failureFlash: true
}));

router.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) return next(err);
    res.redirect('/');
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/');
}

module.exports = router;

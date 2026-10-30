var express = require('express');
var router = express.Router();

const userModel=require("./users");

router.get('/', function(req, res) {
  res.render('index');
});

module.exports = router;

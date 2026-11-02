var express = require('express');
var router = express.Router();

const userModel=require("./users");

router.get('/', function(req, res) {
  res.render('index');
});

router.get('/users', async function(req, res) {
let users=await userModel.create({

  username:"faizan",
  nickname:"faizan",
  description:"this is my description",
  categories:["cat1","cat2"],
  datecreated:Date.now()}
);
res.send(users);
}
);

router.get("/find",async function(req,res){
  var regex = new RegExp("^faizan$", 'i'); 
  let users=await userModel.find({username:regex});
  res.send(users);
}
);
module.exports = router;

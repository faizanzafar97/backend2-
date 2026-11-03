const mongoose= require("mongoose");

const passportLocalMongoose = require('passport-local-mongoose').default;

const userSchema=mongoose.Schema({
  username: { type: String, required: true, unique: true },
  secret:String,
  nickname:String,
  description:String,
  categories:{
    type:Array,
    default:[]
  },
  datecreated:{
    type:Date,
    default:Date.now
  }
})

userSchema.plugin(passportLocalMongoose);

module.exports=mongoose.model("user",userSchema);

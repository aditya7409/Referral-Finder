const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");

const userSchema= new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    phone:{
        type:Number,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    address:{
        type:String,
        
    },
    city:{
        type:String,
        
    },
    state:{
        type:String,
        
    },
    country:{
        type:String,
    },
    gcgpa:{
        type:Number,
    },
    highschool:{
        type:String,
    },
    boards:{
        type:String,
    },
    tokens:[{
        token:{
            type:String,
            required:true
        }
    }],
    resetToken:{
        type:String
    },
    expireToken:{
        type:Date
    }
});

userSchema.methods.generateToken = async function (){
    try{
        const token=jwt.sign({_id:this._id.toString()},process.env.SECRET_KEY);
        this.tokens=this.tokens.concat({token:token});
        await this.save();
        return token;
    }catch(error){
        res.send(error);
        console.log(error);
    }
}

userSchema.pre("save",async function (next){
    if(this.isModified("password"))
    {
        this.password= await bcrypt.hash(this.password,10);
    }
    next();
})

const Register=new mongoose.model("Register",userSchema);

module.exports=Register;
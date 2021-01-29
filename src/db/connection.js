const mongoose=require("mongoose");
mongoose.connect(process.env.db,{
    useCreateIndex:true,
    useNewUrlParser:true,
    useUnifiedTopology:true
}).then( () => {
    console.log("Connection Successful");
}).catch( (error) => {
    console.log(error);
})
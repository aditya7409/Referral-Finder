const mongoose=require("mongoose");
mongoose.connect(process.env.DB_NAME,{
    useCreateIndex:true,
    useNewUrlParser:true,
    useUnifiedTopology:true,
    useFindAndModify:true,
}).then( () => {
    console.log("Connection Successful");
}).catch( (error) => {
    console.log(error);
})
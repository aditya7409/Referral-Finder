//importing all the required node modules
require('dotenv').config();
const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const path = require("path");
const hbs = require("hbs");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const Register = require("./models/registers");
const { json } = require("express");
const nodemailer = require("nodemailer");
const sendgrid = require('nodemailer-sendgrid-transport');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const crypto = require("crypto");
//importing the mongodb connection
require("./db/connection");

//setting up the hosting
const port = process.env.PORT || 8000;

const static_Path = path.join(__dirname, "../public");
const temp_path = path.join(__dirname, "../templates/views");
const partials_path = path.join(__dirname, "../templates/partials");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(static_Path));
app.set("view engine", "hbs");
app.set("views", temp_path);
hbs.registerPartials(partials_path);

//
const transporter = nodemailer.createTransport(sendgridTransport({
    auth: {
        api_key: process.env.API_KEY
    }
}))
//rendering of the homepage
app.get("/", async (req, res) => {
    const token = req.cookies.jwt;
    //if user is not signed in
    if (token == undefined) {
        res.render("index", {});
    }
    //if user is signed in
    else{
        try {
            const verification = jwt.verify(token, process.env.SECRET_KEY);
            const userData = await Register.findOne({ _id: verification._id });
            if (userData) {
                res.render("index", { name: userData.name })
            }
            else {
                res.render("index", {});
            }
        } catch (error) {
            res.render("index", {});
        }
    }
})
//rendering the about page
app.get("/about", async (req, res) => {
    const token = req.cookies.jwt;
    //if user is not signed in
    if (token == undefined) {
        res.render("about", {});
    }
    //if user has signed in
    else {
        try {
            const verification = jwt.verify(token, process.env.SECRET_KEY);
            // console.log(verification);
            const userData = await Register.findOne({ _id: verification._id });
            if (userData) {
                res.render("about", { name: userData.name })
            }
            else {
                res.render("about", {});
            }
        } catch (error) {
            res.render("about", {});
        }
    }
})
//rendering sign in/sign up page
app.get("/register", async (req, res) => {
    res.render("register");
})
//validating sign in/signup
app.post("/register", async (req, res) => {
    try {
        //if user tried to sign in
        if (req.body.userphone === undefined) {
            const email = req.body.useremail;
            const password = req.body.userpassword;
            const useremail = await Register.findOne({ email: email });
            //user tried to sign in without sign up
            if(useremail === null) {
                res.render("index", {
                    message: "Sign up Required",
                    type: "info"
                })
            }
            //user signed in with already existing account
            else {
                //matching up of the password
                const isMatch = await bcrypt.compare(password, useremail.password);
                //if password matched up
                if (isMatch) {
                    //generating token to keep user signed until session
                    const token = await useremail.generateToken();
                    res.cookie("jwt", token, {
                        expires: new Date(Date.now() + 300000),
                        httpOnly: true
                    });
                    //rendering user homepage
                    res.status(200).render("index", {
                        name: useremail.name,
                        message: "Signed in Successfully",
                        type: 'success'
                    });
                }
                //wrong password eneterd
                else {
                    //message invalid credentials
                    res.status(200).render("index", {
                        message: "Invalid Credentials",
                        type: 'danger'
                    });
                }
            }
        }
        //user is trying to sign up
        else {
            const userData = await Register.findOne({ email: req.body.useremail });
            const userData2 = await Register.findOne({ phone: req.body.userphone });
            //checking if entered email and phone already exists
            if (userData || userData2) {
                res.status(201).render('index',{
                    message:"User Already Exist",
                    type:"danger"
                })
            }
            //if new sign up
            else {
                //store user data to data base
                const registerUser = new Register({
                    name: req.body.username,
                    email: req.body.useremail,
                    phone: req.body.userphone,
                    password: req.body.userpassword
                })
                const registered = await registerUser.save();
                //greeting user with sign up email
                transporter.sendMail({
                    to: registerUser.email,
                    from: "noreplyrefferalfinder@gmail.com",
                    subject: "Signed Up Successfully",
                    html: `<h3> Welcome to Referral Finder </h3>`
                })
                //rendering homepage with msg
                res.status(201).render("index", {
                    message: "Signed up Successfully",
                    type: "success"
                });
            }
        }
    } catch (error) {
        res.status(404).send();
    }
})
//rendering user dashboard
app.get("/profile", async (req, res) => {
    const token = req.cookies.jwt;
    const verification = jwt.verify(token, process.env.SECRET_KEY);
    const userData = await Register.findOne({ _id: verification._id });
    res.render("profile", {
        name: userData.name,
        gcgpa: userData.gcgpa
    });
})
//adding user qualifications to data base
app.post("/profile", async (req, res) => {
    const token = req.cookies.jwt;
    const verification = jwt.verify(token, process.env.SECRET_KEY);
    const userData = await Register.findOne({ _id: verification._id });
    userData.website = req.body.usersite;
    userData.address = req.body.useraddress
    userData.city = req.body.usercity;
    userData.country = req.body.usercountry;
    userData.gcgpa = req.body.usergcgpa;
    userData.highschool = req.body.userhsch;
    userData.boards = req.body.userboard;
    //saving user qualifications to home page
    await userData.save();
    //rendering profile after saving data
    res.render("profile", {
        name: userData.name,
        gcgpa: userData.gcgpa
    })
})
//rendering the updating the data page
app.get("/update", async (req, res) => {
    res.render("profile", {});
})
//rednering the reset password page
app.get("/resetpassword", (req, res) => {
    res.render("reset");
})
//updating the password
app.post("/resetpassword", async (req, res) => {
    crypto.randomBytes(32, async (err, buffer) => {
        if (err) {
            console.log(err);
        }
        const token = buffer.toString("hex");
        //checking if associated email has account with us
        const userData = await Register.findOne({ email: req.body.useremail })
        //if no account found with the given email
        if (userData === null) {
            res.render("index", {
                message: "No Such Account Exists",
                type: "info"
            })
        }
        //if email found
        else {
            userData.resetToken = token;
            userData.expireToken = Date.now() + 3600000;
            await userData.save()
            //send user the link to reset the password
            transporter.sendMail({
                to: userData.email,
                from: "noreplyrefferalfinder@gmail.com",
                subject: "PassWord Reset",
                html: `<p><a href="https://referralfinder.herokuapp.com/resetpass/${token}">Link</a> Reset Password,it will only be valid for 1 hr</p>`
            })
            //rendering homepage with msg
            res.render('index', {
                message: "Password Reset Link Sent to email",
                type: "info"
            });
        }
    })
})
//rendering the newpassword page
app.get("/resetpass/:token", (req, res) => {
    res.render("newpassword", { newpassToken: req.params.token });
})
//saving the new password in db after deleting the old password
app.post("/resetpass/:token", async (req, res) => {
    const token = (req.params.token);
    const newpassword = req.body.usernewpass;
    const userData = await Register.findOne({ resetToken: token });
    //hashing the new password for security
    userData.password = await bcrypt.hash(newpassword, 10);
    userData.password = newpassword;
    //saving up the new password
    await userData.save();
    //rendering homepage with msg
    res.render("index", {
        message: "Password Changed Successfully",
        type: "success"
    })
})
//logging out user from all devices
app.get("/logout", async (req, res) => {
    res.clearCookie("jwt");
    const token = req.cookies.jwt;
    const verification = jwt.verify(token, process.env.SECRET_KEY);
    const userData = await Register.findOne({ _id: verification._id });
    //removing the sign in token for logging out
    userData.tokens = [];
    //saving in db
    await userData.save();
    //rednering homepage with msg
    res.render("index", {
        message: "User logged out Successfully",
        type: "info"
    });;
})


app.listen(port, () => {
    console.log(`Server Running At Port ${port}`);
})
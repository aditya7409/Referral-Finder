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
require("./db/connection");

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


const transporter = nodemailer.createTransport(sendgridTransport({
    auth: {
        api_key: process.env.API_KEY
    }
}))
app.get("/", async (req, res) => {
    const token = req.cookies.jwt;
    if (token == undefined) {
        res.render("index", {});
    }
    else {
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
app.get("/about", async (req, res) => {
    const token = req.cookies.jwt;
    if (token == undefined) {
        res.render("about", {});
    }
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
app.get("/register", async (req, res) => {
    res.render("register");
})
app.post("/register", async (req, res) => {
    try {
        if (req.body.userphone === undefined) {
            const email = req.body.useremail;
            const password = req.body.userpassword;
            const useremail = await Register.findOne({ email: email });
            if (useremail === null) {
                res.render("index", {
                    message: "Sign up Required",
                    type: "info"
                })
            }
            else {
                const isMatch = await bcrypt.compare(password, useremail.password);
                
                if (isMatch) {
                    const token = await useremail.generateToken();
                    res.cookie("jwt", token, {
                        expires: new Date(Date.now() + 300000),
                        httpOnly: true
                    });
                    res.status(200).render("index", {
                        name: useremail.name,
                        message: "Signed in Successfully",
                        type: 'success'
                    });
                }
                else {
                    
                    res.status(200).render("index", {
                        message: "Invalid Credentials",
                        type: 'danger'
                    });
                }
            }
        }
        else {
            const userData = await Register.findOne({ email: req.body.useremail });
            // console.log(userData);
            if (userData) {
                res.status(201).render('index',{
                    message:"User Already Exist",
                    type:"danger"
                })
            }
            else {
                const registerUser = new Register({
                    name: req.body.username,
                    email: req.body.useremail,
                    phone: req.body.userphone,
                    password: req.body.userpassword
                })
                const registered = await registerUser.save();
                transporter.sendMail({
                    to: registerUser.email,
                    from: "noreplyrefferalfinder@gmail.com",
                    subject: "Signed Up Successfully",
                    html: `<h3> Welcome to Refferal Finder </h3>`
                })
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
app.get("/profile", async (req, res) => {
    const token = req.cookies.jwt;
    const verification = jwt.verify(token, process.env.SECRET_KEY);
    const userData = await Register.findOne({ _id: verification._id });
    res.render("profile", {
        name: userData.name,
        gcgpa: userData.gcgpa
    });
})
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

    await userData.save();
    res.render("profile", {
        name: userData.name,
        gcgpa: userData.gcgpa
    })
})
app.get("/update", async (req, res) => {
    res.render("profile", {});
})
app.get("/resetpassword", (req, res) => {
    res.render("reset");
})
app.post("/resetpassword", async (req, res) => {
    crypto.randomBytes(32, async (err, buffer) => {
        if (err) {
            console.log(err);
        }
        const token = buffer.toString("hex");
        const userData = await Register.findOne({ email: req.body.useremail })
        if (userData === null) {
            res.render("index", {
                message: "No Such Account Exists",
                type: "info"
            })
        }
        else {
            userData.resetToken = token;
            userData.expireToken = Date.now() + 3600000;
            await userData.save()
            transporter.sendMail({
                to: userData.email,
                from: "noreplyrefferalfinder@gmail.com",
                subject: "PassWord Reset",
                html: `<p><a href="http://localhost:8000/resetpass/${token}">Link</a> Reset Password,it will only be valid for 1 hr</p>`
            })
            res.render('index', {
                message: "Password Reset Link Sent to email",
                type: "info"
            });
        }
    })
})
app.get("/resetpass/:token", (req, res) => {
    res.render("newpassword", { newpassToken: req.params.token });
})
app.post("/resetpass/:token", async (req, res) => {
    const token = (req.params.token);
    const newpassword = req.body.usernewpass;
    const userData = await Register.findOne({ resetToken: token });
    userData.password = await bcrypt.hash(newpassword, 10);
    userData.password = newpassword;
    await userData.save();
    res.render("index", {
        message: "Password Changed Successfully",
        type: "success"
    })
})
app.get("/logout", async (req, res) => {
    res.clearCookie("jwt");
    const token = req.cookies.jwt;
    const verification = jwt.verify(token, process.env.SECRET_KEY);
    const userData = await Register.findOne({ _id: verification._id });
    userData.tokens = [];
    await userData.save();
    res.render("index", {
        message: "User logged out Successfully",
        type: "info"
    });;
})


app.listen(port, () => {
    console.log(`Server Running At Port ${port}`);
})
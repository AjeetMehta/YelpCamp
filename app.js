const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Campground = require(__dirname+"/models/campground");
const Comment = require(__dirname+"/models/comment");
const User = require(__dirname+"/models/user");

const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const methodOverride = require("method-override");

//-------------------CONNECT TO DB--------------
// Using `mongoose.connect`...
//  mongoose.connect("mongodb://localhost/CampInfo");

mongoose.connect("mongodb+srv://AjeetMehta:ajeet1234@cluster0.2zavz.mongodb.net/CampInfo?retryWrites=true&w=majority",{ useNewUrlParser: true });


//---------------APP CONFIG-----------------
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));

//---------------PASSPORT CONFIG-----------------
app.use(session({
		secret: "Apple is a fruit",
		resave: false,
		saveUninitialized: false}));

app.use(passport.initialize())
app.use(passport.session())
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//creates middleware to pass user data (check if logged in) for EVERY route
app.use(function(req, res, next){
	res.locals.currentUser = req.user;
	next();
});

//---------------APP ROUTING----------------
app.get("/", function(req, res) {
	res.render("landing");
})

//INDEX route - show all campgrounds
app.get("/campgrounds", function(req, res){
	Campground.find({},function(err,foundCamp){
		if (err)
			console.log(err);
		else {
			res.render("campgrounds/index", {
				campgrounds:foundCamp
			});
		}
	});
});

//CREATE- add new campground to DB
app.post('/campgrounds',isLoggedIn,function(req, res){
	var name = req.body.name;
	var image = req.body.image;
	var description = req.body.description;
	let author = {
		id: req.user._id,
		username: req.user.username
	}
	var newCampground = {name,image,description,author}

	//Create a new campground and save it to DB:
	Campground.create(newCampground, (err, new_camp) => {
		if (err)
			console.log(err);
		else {
			res.redirect('/campgrounds');
		}
	});
});

//NEW - show form to create new campground
app.get("/campgrounds/new",isLoggedIn,function(req, res){
	res.render('campgrounds/new');
})

//SHOW - show info about a single camp ID
app.get("/campgrounds/:id",function(req, res){
	Campground.findById(req.params.id).populate("comments").exec(function(err, foundCamp){
			if (err)
				console.log(err);
			else {
				res.render("campgrounds/show", {campground: foundCamp});
			}
		});
});

// EDIT CAMPGROUND ROUTE
app.get("/campgrounds/:id/edit",checkCampOwnership,function(req, res){
		Campground.findById(req.params.id,function(err, foundCamp){
			res.render("campgrounds/edit", {campground: foundCamp});
		});
	});

// UPDATE CAMPGROUND ROUTE
app.put("/campgrounds/:id",checkCampOwnership,function(req, res){
	Campground.findByIdAndUpdate(req.params.id,req.body.campground,function(err, updatedCamp){
			if (err)
			  res.redirect("/campgrounds");
			else
			  res.redirect("/campgrounds/"+req.params.id);
		});
});

// DESTROY CAMPGROUND ROUTE
app.delete("/campgrounds/:id",checkCampOwnership,function(req, res){
	Campground.findByIdAndRemove(req.params.id,function(err, deletedCamp){
		if (err)
		 res.redirect("/campgrounds/"+req.params.id);
		else
		 res.redirect("/campgrounds");
	});
});

app.get("/campgrounds/:id/comments/new",isLoggedIn,function(req, res){
		Campground.findById(req.params.id,function(err, foundCamp){
			if (err)
				console.log(err);
			else
				res.render('comments/new', { campground: foundCamp });
		});
	});

//Comments create
app.post("/campgrounds/:id/comments",isLoggedIn,function(req, res){
	Campground.findById(req.params.id,function(err, foundCamp){
		if (err) {
			console.log(err);
			res.redirect("/campgrounds");
		} else {
			Comment.create(req.body.comment,function(err, new_comm){
				if (err)
					console.log(err);
				else {
					console.log(new_comm);
					new_comm.author.id = req.user._id;
					new_comm.author.username = req.user.username;
					new_comm.save();
					foundCamp.comments.push(new_comm);
					foundCamp.save();
					res.redirect("/campgrounds/"+ foundCamp._id);
				}
			});
		}
	});
});

//Edit comment route
app.get("/campgrounds/:id/comments/:comment_id/edit",checkCommentOwnership,function(req, res){
		Comment.findById(req.params.comment_id,function(err, foundComment){
			if (err)
			 res.redirect("back");
			else
				res.render("comments/edit", {comment: foundComment,campground_id: req.params.id});
		});
	});

//Update comment route
app.put("/campgrounds/:id/comments/:comment_id",checkCommentOwnership,function(req, res){
		Comment.findByIdAndUpdate(req.params.comment_id,req.body.comment,function(err, updatedComment){
				if (err)
				 res.redirect("back");
				else
				 res.redirect("/campgrounds/"+ req.params.id);
			});
	});

// Destroy comment route
app.delete("/campgrounds/:id/comments/:comment_id",checkCommentOwnership,function(req, res){
		Comment.findByIdAndRemove(req.params.comment_id,function(err, deletedComment){
			res.redirect("/campgrounds/"+ req.params.id);
		});
	});


//-------------AUTH ROUTES-----------------
app.get("/signup",function(req, res){
	res.render("auth/signup");
});

app.post("/signup",function(req, res){
	let newUser = new User({ username: req.body.username });
	User.register(newUser, req.body.password,function(err, user){
		if (err) {
			console.log(err)
			return res.render("auth/signup");
		}
		passport.authenticate("local")(req, res, function(){
			res.redirect("/campgrounds");
		});
	});
});

app.get("/login",function(req, res){
	res.render("auth/login")
});

app.post("/login",passport.authenticate("local", {
		successRedirect: "/campgrounds",
		failureRedirect: "/login"
	}),function(req, res){})

app.get("/logout",function(req, res){
	req.logout();
	res.redirect("/campgrounds");
});

//-------------404 PAGE-----------------
app.get('*', (req, res) => {
	res.send('404 NOTHING TO SEE HERE...')
})


function isLoggedIn(req, res, next){
	if (req.isAuthenticated())
		return next();
	res.redirect("/login");
}

function checkCampOwnership(req, res, next){
	if (req.isAuthenticated()) {
		Campground.findById(req.params.id, (err, foundCamp) => {
			if (err)
			 res.redirect("back");
			else {
				if(foundCamp.author.id.equals(req.user._id))
				 next();
				else
				 res.redirect("back");
			}
		});
	}
	else
	 res.redirect("back");
}

function checkCommentOwnership(req, res, next){
	if (req.isAuthenticated()) {
		Comment.findById(req.params.comment_id, (err, foundComment) => {
			if (err)
			 res.redirect("back");
			else {
				if (foundComment.author.id.equals(req.user._id))
				 next();
				else
				 res.redirect("back");
			}
		});
	}
	else
	 res.redirect("back");
}

//-------------APP LISTEN 3000---------------
let port = process.env.PORT || 3000;

app.listen(port, function() {
	console.log("Our app is running on");
});

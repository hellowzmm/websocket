var express = require("express");
var app = express();
var router = require("./router");
var session = require("express-session");
var http = require("http").Server(app);
var io = require("socket.io")(http);
app.set("view engine", "ejs");
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true
  })
);
app.use(express.static("./public"));
app.use(express.static("./avatar"));

app.get("/", router.showIndex);
app.get("/index", router.showIndex);
app.get("/regist", router.showRegist);
app.get("/setavatar", router.setAvatar);
app.get("/dologin", router.doLogin);
app.post("/doregist", router.doRegist);
app.get("/dologout", router.doLogout);
app.post("/uploadavatar", router.uploadAvatar);
app.post("/newroom",router.newRoom)
app.get("/cropavatar", router.cropAvatar);
app.get("/roomentry", router.showEntry);
app.get("/chatroom", router.showChatRoom);
app.get("/getrecords", router.getRecords);
app.get("/records", router.showRecords);
app.get("/usermanage", router.showManage);
app.get("/forbiddenuser", router.forbiddenUser);
app.get("/unforbiddenuser", router.unForbiddenUser);
app.get("/deleteuser", router.deleteUser);
app.get("/roommanage", router.showRoomManage);
app.get("/forbiddenroom", router.forbiddenRoom);
app.get("/unforbiddenroom", router.unForbiddenRoom);
app.get("/deleteroom", router.deleteRoom);

io.on("connection", function(socket) {
  socket.on("chatroom", function(msg) {
    router.saveShuoShuo(io, msg);
  });
});

http.listen(8088);

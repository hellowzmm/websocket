var formidable = require("formidable");
var db = require("../model/db");
var crypto = require("crypto");
var path = require("path");
var fs = require("fs");
var gm = require("gm");
exports.showIndex = function(req, res) {
  if (req.session.login) {
    db.find("users", { username: req.session.username }, function(err, result) {
      res.render("index", {
        login: true,
        username: result[0].username,
        avatar:
          result[0].avatar == "avatar.jpg" ? "avatar.jpg" : result[0].avatar,
        forbidden: result[0].forbidden || false
      });
    });
  } else
    res.render("index", {
      login: false,
      username: "",
      avatar: "",
      forbidden: false
    });
};

exports.showRegist = function(req, res) {
  res.render("regist", {
    login: false,
    username: "",
    avatar: ""
  });
};

exports.doRegist = function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    var username = fields.username;
    var password = fields.password;
    var mipassword =
      crypto
        .createHash("md5")
        .update(password)
        .digest("base64") + "2";
    db.getAllCount("users", { username: username }, function(count) {
      if (count > 0) {
        res.send("-1");
        return;
      } else {
        db.insertOne(
          "users",
          {
            username: username,
            password: mipassword,
            avatar: "avatar.jpg",
            login: true,
            forbidden: false
          },
          function(err, result) {
            if (err) {
              res.send("-3");
              return;
            } else {
              req.session.login = true;
              req.session.username = username;
              req.session.avatar = "avatar.jpg";
              req.session.forbidden = false;
              res.send("1");
              return;
            }
          }
        );
      }
    });
  });
};

exports.doLogin = function(req, res) {
  db.find("users", { username: req.query.username }, function(err, result) {
    if (err) {
      res.send("-1");
      return;
    }
    if (result.length > 0) {
      if (!result[0].login) {
        var password =
          crypto
            .createHash("md5")
            .update(req.query.password)
            .digest("base64") + "2";
        if (result[0].password == password) {
          var _result = result;
          db.updateMany(
            "users",
            { username: result[0].username },
            { $set: { login: true } },
            {},
            function(err, result) {
              req.session.login = true;
              req.session.username = req.query.username;
              req.session.avatar =
                _result[0].avatar == "avatar.jpg"
                  ? "avatar.jpg"
                  : _result[0].avatar;
              req.session.forbidden = _result[0].forbidden || false;
              res.send("1");
            }
          );
        } else {
          res.send("-2");
          return;
        }
      } else {
        res.send("-4");
      }
    } else {
      res.send("-3");
      return;
    }
  });
};

exports.doLogout = function(req, res) {
  db.updateMany(
    "users",
    { username: req.session.username },
    { $set: { login: false } },
    {},
    function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      req.session.login = false;
      req.session.username = "";
      req.session.avatar = "";
      req.session.forbidden = false;
      res.send("1");
    }
  );
};

exports.setAvatar = function(req, res) {
  if (!req.session.login) {
    res.send("您还没登陆");
    return;
  }
  res.render("setavatar", {
    login: req.session.login,
    username: req.session.username,
    avatar:
      req.session.avatar == "avatar.jpg" ? "avatar.jpg" : req.session.avatar,
    forbidden: req.session.forbidden || false
  });
};

exports.uploadAvatar = function(req, res) {
  var form = new formidable.IncomingForm();
  form.uploadDir = path.normalize(__dirname + "/../avatar");
  form.parse(req, function(err, fields, files) {
    var oldpath = files.avatar.path;
    var newpath =
      form.uploadDir +
      "/" +
      req.session.username +
      path.extname(files.avatar.name);
    fs.rename(oldpath, newpath, function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      db.updateMany(
        "users",
        { username: req.session.username },
        {
          $set: {
            avatar: req.session.username + path.extname(files.avatar.name)
          }
        },
        function(err, result) {
          if (err) {
            console.log(err);
            return;
          }
          req.session.avatar =
            req.session.username + path.extname(files.avatar.name);
          res.redirect("/setAvatar");
        }
      );
    });
  });
};

exports.newRoom = function(req, res) {
  var form = new formidable.IncomingForm();
  form.uploadDir = path.normalize(__dirname + "/../public/images");
  form.parse(req, function(err, fields, files) {
    var oldpath = files.avatar.path;
    var newpath =
      form.uploadDir + "/" + fields.id + path.extname(files.avatar.name);
    fs.rename(oldpath, newpath, function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      gm("./public/images/" + fields.id + path.extname(files.avatar.name))
        .resize(100, 100, "!")
        .write(
          "./public/images/" + fields.id + path.extname(files.avatar.name),
          function(err) {
            if (err) {
              console.log(err);
              return;
            }
          }
        );
      db.insertOne(
        "rooms",
        {
          id: fields.id,
          introduction: fields.introduction,
          avatar: fields.id + path.extname(files.avatar.name),
          forbidden: false
        },
        function(err, result) {
          if (err) {
            console.log(err);
            return;
          }
          res.redirect("/roommanage");
        }
      );
    });
  });
};

exports.cropAvatar = function(req, res) {
  gm("./avatar/" + req.query.filename)
    .crop(
      parseInt(req.query.w),
      parseInt(req.query.h),
      parseInt(req.query.x),
      parseInt(req.query.y)
    )
    .resize(100, 100, "!")
    .write("./avatar/" + req.query.filename, function(err) {
      if (err) {
        console.log(err);
        return;
      }
      res.send("1");
    });
};

exports.saveShuoShuo = function(io, msg) {
  var forbiddenroom = false;
  var forbiddenuser = false;
  db.find("rooms", { id: msg.id }, function(err, result) {
    var roomresult = result;
    if (err) {
      console.log(err);
      return;
    }
    if (result[0].forbidden) {
      forbiddenroom = true;
    }
    db.find("users", { username: msg.username }, {}, function(err, result) {
      if (result[0].forbidden) {
        console.log("???");
        var errmsg = {
          forbiddenuser: true,
          roomId: msg.id
        };
        io.emit("chatroom", errmsg);
        return;
      }
      var date = new Date();
      date = date.toLocaleString();
      var _result = result;
      db.insertOne(
        "messages",
        {
          username: msg.username,
          message: msg.message,
          avatar: _result[0].avatar,
          roomId: msg.id,
          time: date
        },
        function(err, result) {
          if (err) {
            console.log(err);
            return;
          }
          var _msg = Object.assign({}, msg, {
            avatar: _result[0].avatar,
            forbiddenroom: forbiddenroom
          });
          io.emit("chatroom", _msg);
        }
      );
    });
  });
};

exports.showEntry = function(req, res) {
  if (!req.session.login) {
    res.send("您还未登陆");
    return;
  }
  db.find("rooms", {}, function(err, result) {
    if (err) {
      console.log(err);
      return;
    }
    res.render("chatroomEntry", {
      login: req.session.login || false,
      username: req.session.username || "",
      avatar: req.session.avatar || "",
      rooms: result.length > 0 ? result : []
    });
  });
};

exports.showChatRoom = function(req, res) {
  if (!req.session.login) {
    res.send("你还没有登陆");
    return;
  }
  db.find("rooms", { id: req.query.id }, function(err, result) {
    if (err) {
      console.log(err);
      return;
    }
    var _result = result;
    db.find("users", { username: req.session.username }, function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      res.render("chatroom", {
        login: req.session.login || false,
        username: req.session.username || "",
        avatar: req.session.avatar || "",
        forbidden: result[0].forbidden,
        forbiddenroom: _result[0].forbidden,
        id: req.query.id
      });
    });
  });
};

exports.getRecords = function(req, res) {
  var amount = 10;
  console.log(req.param("id"));
  db.find(
    "messages",
    { roomId: req.param("id") },
    { pageamount: amount, page: req.query.page || 0, sort: { time: -1 } },
    function(err, result) {
      if (err) {
        console.log(err);
        return;
      }
      res.send(result);
    }
  );
};

exports.showRecords = function(req, res) {
  if (!req.session.login) {
    res.send("您还没登陆");
    return;
  }
  res.render("records", {
    login: req.session.login || false,
    username: req.session.username || "",
    avatar: req.session.avatar || "",
    forbidden: req.session.forbidden || false
  });
};

exports.showManage = function(req, res) {
  if (!req.session.login || req.session.username != "lvshihao") {
    res.send("无权限");
    return;
  }
  db.find("users", {}, function(err, result) {
    if (err) {
      console.log(err);
      return;
    }
    res.render("usermanage", {
      login: req.session.login || false,
      username: req.session.username || "",
      avatar: req.session.avatar || "",
      forbidden: req.session.forbidden || false,
      users: result.slice(1)
    });
  });
};

exports.deleteUser = function(req, res) {
  db.deleteMany("users", { username: req.query.username }, function(
    err,
    result
  ) {
    if (err) {
      console.log(err);
      res.send("-1");
      return;
    }
    res.send("1");
  });
};

exports.forbiddenUser = function(req, res) {
  db.updateMany(
    "users",
    { username: req.query.username },
    { $set: { forbidden: true } },
    function(err, result) {
      if (err) {
        console.log(err);
        res.send("-1");
        return;
      }
      res.send("1");
    }
  );
};

exports.unForbiddenUser = function(req, res) {
  db.updateMany(
    "users",
    { username: req.query.username },
    { $set: { forbidden: false } },
    function(err, result) {
      if (err) {
        console.log(err);
        res.send("-1");
        return;
      }
      res.send("1");
    }
  );
};

exports.showRoomManage = function(req, res) {
  if (!req.session.login || req.session.username != "lvshihao") {
    res.send("无权限");
    return;
  }
  db.find("rooms", {}, function(err, result) {
    if (err) {
      console.log(err);
      return;
    }
    res.render("roommanage", {
      login: req.session.login || false,
      username: req.session.username || "",
      rooms: result
    });
  });
};

exports.forbiddenRoom = function(req, res) {
  db.updateMany(
    "rooms",
    { id: req.query.id },
    { $set: { forbidden: true } },
    function(err, result) {
      if (err) {
        console.log(err);
        res.send("-1");
        return;
      }
      res.send("1");
    }
  );
};

exports.unForbiddenRoom = function(req, res) {
  db.updateMany(
    "rooms",
    { id: req.query.id },
    { $set: { forbidden: false } },
    function(err, result) {
      if (err) {
        console.log(err);
        res.send("-1");
        return;
      }
      res.send("1");
    }
  );
};

exports.deleteRoom = function(req, res) {
  db.find("rooms", { id: req.query.id }, function(err, result) {
    if (err) {
      console.log(err);
      res.send("-1");
      return;
    }
    fs.unlink(
      path.normalize(__dirname, `/../public/images/${result[0].avatar}`),
      function() {
        db.deleteMany("rooms", { id: req.query.id }, function(err, result) {
          if (err) {
            console.log(err);
            res.send("-1");
            return;
          }
          db.deleteMany("messages", { roomId: req.query.id }, function(
            err,
            result
          ) {
            if (err) {
              console.log(err);
              res.send("-1");
              return;
            }
            res.send("1");
          });
        });
      }
    );
  });
};

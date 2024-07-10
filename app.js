const express = require("express");
const http = require("http");
const path = require("path");
const scoketio = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = scoketio(server);

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", function (socket) {
  socket.on("send-location", function (data) {
    io.emit("receive-location", { id: socket.id, ...data });
  });

  socket.on("disconnect", (socket) => {
    io.emit("user-disconnect", socket.id);
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(3000);

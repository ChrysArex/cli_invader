import express from "express";
import expressWs from "express-ws";

class GameServer {
  constructor(app) {
    this.sessions = { init: 0 };
    this.ssId = "init";
    this.server = app ? app : express();
    expressWs(this.server);
    this.server.get("/hello", (req, res) => res.send("hello my gee\n"));
    this.server.ws("/newGame", this.newGame.bind(this));
  }

  newGame(ws, req) {
    if (
      Object.keys(this.sessions).length !== 0 &&
      this.sessions[this.ssId].length < 6
    ) {
      this.sessions[this.ssId].push(ws);
      console.log(
        `new player added, the sessions so far: ${this.sessions[this.ssId]}`,
      );
    } else {
      this.ssId = crypto.randomUUID();
      this.sessions[this.ssId] = [ws];
      console.log(`new sessions created, sessions id: ${this.ssId}`);
    }
  }

  listen(port, callback) {
    this.server.listen(port, callback);
  }
}

const server = new GameServer();
server.listen(3000, () => console.log("Server is listenning"));

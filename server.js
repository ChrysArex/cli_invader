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
    //console.log(req.headers["playerid"]);
    this.initSession(ws, req.headers["playerid"]); //manage session for the new connection
    this.setUpListeners(ws, req); //set liteners for the new connection
  }

  initSession(ws, playerId) {
    if (
      Object.keys(this.sessions).length !== 0 &&
      this.sessions[this.ssId].length < 6
    ) {
      this.sessions[this.ssId].push({ ws: ws, playerId: playerId });
      ws.send(JSON.stringify({ type: "ssId", content: this.ssId }));
      console.log(
        `new player added, the sessions so far: ${this.sessions[this.ssId]}`,
      );
    } else {
      this.ssId = crypto.randomUUID();
      this.sessions[this.ssId] = [{ ws: ws, playerId: playerId }];
      ws.send(JSON.stringify({ type: "ssId", content: this.ssId }));
      console.log(`new sessions created, sessions id: ${this.ssId}`);
    }
  }

  setUpListeners(ws, req) {
    ws.on("message", (msg) => {
      console.log("Message broadcasted");
      this.broadcast(msg, this.sessions[JSON.parse(msg).sessionId]);
    });
  }

  broadcast(message, players) {
    players.forEach((player) => {
      if (player["playerId"] !== JSON.parse(message).senderId)
        player.ws.send(JSON.stringify(JSON.parse(message).content));
    });
  }

  listen(port, callback) {
    this.server.listen(port, callback);
  }
}

const server = new GameServer();
server.listen(3000, () => console.log("Server is listenning"));

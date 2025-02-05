import express from "express";
import expressWs from "express-ws";

class GameServer {
  constructor(app) {
    this.sessions = { init: 0 };
    this.ssId = "init";
    this.server = app ? app : express();
    this.typeIdx = -1;
    expressWs(this.server);
    this.server.get("/hello", (req, res) => res.send("hello my gee\n"));
    this.server.ws("/newGame", this.newGame.bind(this));
  }

  newGame(ws, req) {
    //console.log(req.headers["playerid"]);
    this.initSession(ws, req.headers["playerid"]); //manage session for the new connection
    this.setUpListeners(ws, req.headers["playerid"]); //set liteners for the new connection
  }

  initSession(ws, playerId) {
    this.typeIdx += 1;
    const playerType = this.typeIdx % 2 === 0 ? "vessel" : "opponent";
    if (
      Object.keys(this.sessions).length !== 0 &&
      this.sessions[this.ssId].length < 6
    ) {
      this.sessions[this.ssId].push({
        ws: ws,
        playerId: playerId,
        playerType: playerType,
      });

      ws.send(
        JSON.stringify({
          type: "init",
          ssId: this.ssId,
          playerType: playerType,
        }),
      );

      console.log(
        `new player added, the sessions so far: ${this.sessions[this.ssId]}`,
      );
    } else {
      this.ssId = crypto.randomUUID();
      this.sessions[this.ssId] = [
        { ws: ws, playerId: playerId, playerType: playerType },
      ];

      ws.send(
        JSON.stringify({
          type: "init",
          ssId: this.ssId,
          playerType: playerType,
        }),
      );

      console.log(`new sessions created, sessions id: ${this.ssId}`);
    }
  }

  setUpListeners(ws, playerId) {
    ws.on("message", (msg) => {
      console.log("Message broadcasted");
      this.broadcast(msg, this.sessions[JSON.parse(msg).sessionId]);
    });

    ws.on("close", () => {
      console.log(`Player ${playerId} disconnected`);
    });
  }

  broadcast(message, players) {
    players.forEach((player) => {
      if (player["playerId"] !== JSON.parse(message).senderId) {
        if (player.playerType === JSON.parse(message).playerType)
          player.ws.send(JSON.stringify(JSON.parse(message).content));
        else
          player.ws.send(
            JSON.stringify(
              "A message has been sent by a guy of the other team, here is you version of it!",
            ),
          );
      }
    });
  }

  listen(port, callback) {
    this.server.listen(port, callback);
  }
}

const server = new GameServer();
server.listen(3000, () => console.log("Server is listenning"));

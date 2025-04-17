import express from "express";
import expressWs from "express-ws";
import { objectsSize } from "./utils.js";
import { hasCollide } from "./collision.js";

class GameServer {
  constructor(app) {
    this.sessions = { init: 0 };
    this.ssId = "init";
    this.server = app ? app : express();
    this.typeIdx = -1;
    this.vesselPosXRef = 2;
    this.opponentPosXRef = 2;
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
    const playerTypeInfo =
      this.typeIdx % 2 === 0
        ? ["vessel", this.vesselPosXRef, 5]
        : ["opponent", this.opponentPosXRef, 0];

    if (
      Object.keys(this.sessions).length !== 0 &&
      this.sessions[this.ssId].clientCount <= 6
    ) {
      this.sessions[this.ssId]["connections"][playerId] = {
        ws: ws,
        playerId: playerId,
        playerType: playerTypeInfo[0],
      };
      this.sessions[this.ssId]["referenceGameState"][playerId] = {
        playerId: playerId,
        posX: playerTypeInfo[1],
        posY: playerTypeInfo[2],
        type: playerTypeInfo[0],
        lp: 100,
        width: objectsSize[playerTypeInfo[0]][0],
        heigth: objectsSize[playerTypeInfo[0]][1],
      };
      this.sessions[this.ssId]["clientCount"] += 1;
      console.log(
        `new player added, the sessions so far: ${this.sessions[this.ssId]["referenceGameState"]}`,
      );
    } else {
      this.vesselPosXRef = 2;
      this.opponentPosXRef = 2;

      this.ssId = crypto.randomUUID();
      this.sessions[this.ssId] = {
        referenceGameState: {},
        connections: {},
        clientCount: 0,
      };

      this.sessions[this.ssId]["referenceGameState"][playerId] = {
        playerId: playerId,
        posX: playerTypeInfo[1],
        posY: playerTypeInfo[2],
        type: playerTypeInfo[0],
        lp: 100,
        width: objectsSize[playerTypeInfo[0]][0],
        heigth: objectsSize[playerTypeInfo[0]][1],
      };

      this.sessions[this.ssId]["connections"][playerId] = {
        ws: ws,
        playerId: playerId,
        playerType: playerTypeInfo[0],
      };

      this.sessions[this.ssId]["clientCount"] += 1;

      console.log(`new sessions created, sessions id: ${this.ssId}`);
    }

    ws.send(
      JSON.stringify({
        messageType: "unique",
        topic: "init",
        sessionId: this.ssId,
        senderId: null,
        content: {
          ssId: this.ssId,
          playerType: playerTypeInfo[0],
          initPosX: playerTypeInfo[1],
          initPosY: playerTypeInfo[2],
          gameState: Object.values(
            this.sessions[this.ssId]["referenceGameState"],
          ),
        },
      }),
    );
    this.broadcast(
      JSON.stringify({
        messageType: "broadcast",
        topic: "stateUpdate",
        sessionId: this.ssId,
        senderId: playerId,
        content: Object.values(this.sessions[this.ssId]["referenceGameState"]),
      }),
      Object.values(this.sessions[this.ssId]["connections"]),
    );
    this.vesselPosXRef += objectsSize["vessel"][0] + 1;
    this.opponentPosXRef += objectsSize["opponent"][0] + 1;
  }

  setUpListeners(ws, playerId) {
    ws.on("message", (msg) => {
      const msgObj = JSON.parse(msg);
      if (msgObj.topic === "stateUpdate") {
        this.sessions[msgObj.sessionId]["referenceGameState"][msgObj.senderId] =
          msgObj.content;
      } else if (msgObj.topic === "shootSomeone") {
        //perform a verification of the shoot and a reference update
        //hasCollide(shift, obj1, obj2);
        this.sessions[msgObj.sessionId]["referenceGameState"][msgObj.senderId] =
          msgObj.content;
        msgObj.topic = "shootSomeone";
      } else if (msgObj.topic === "endGame") {
        //Perform necessary verification to ensure the player has been destroyed
        delete this.sessions[msgObj.sessionId]["referenceGameState"][
          msgObj.senderId
        ];
        delete this.sessions[msgObj.sessionId]["connections"][msgObj.senderId];
        if (msgObj.playerType === "vessel" || msgObj.playerType === "opponent")
          this.sessions[msgObj.sessionId]["clientCount"] -= 1;
        if (msgObj.target) {
          if (msgObj.target.lp === 0) {
            const targetConnection =
              this.sessions[msgObj.sessionId]["connections"][
                msgObj.target.playerId
              ];
            targetConnection.ws.close(1000, "player has been destroyed");
            delete this.sessions[msgObj.sessionId]["connections"][
              msgObj.target.playerId
            ];
            delete this.sessions[msgObj.sessionId]["referenceGameState"][
              msgObj.target.playerId
            ];
            if (
              msgObj.target.playerType === "vessel" ||
              msgObj.target.playerType === "opponent"
            )
              this.sessions[msgObj.sessionId]["clientCount"] -= 1;
          } else {
            this.sessions[msgObj.sessionId]["referenceGameState"][
              msgObj.target.playerId
            ] = msgObj.target;
          }
        }
      }

      if (msgObj.authorId) msgObj.senderId = msgObj.authorId;

      msgObj.content = Object.values(
        this.sessions[msgObj.sessionId]["referenceGameState"],
      );

      this.broadcast(
        JSON.stringify(msgObj),
        Object.values(this.sessions[msgObj.sessionId]["connections"]),
      );
      console.log("Message broadcasted");
    });

    ws.on("close", () => {
      console.log(`Player ${playerId} disconnected`);
    });
  }

  broadcast(message, players) {
    const msgObj = JSON.parse(message);
    players.forEach((player) => {
      if (
        msgObj.messageType === "broadcast" &&
        player["playerId"] !== msgObj.senderId
      )
        player.ws.send(message);
      else if (
        player["playerId"] !== msgObj.senderId &&
        player.playerType === msgObj.playerType
      ) {
        player.ws.send(message);
      }
    });
  }

  listen(port, callback) {
    this.server.listen(port, callback);
  }
}

const server = new GameServer();
server.listen(3000, () => console.log("Server is listenning"));

import express from "express";
import expressWs from "express-ws";
import { objectsSize } from "./utils.js";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "redis";
//import { hasCollide } from "./collision.js";

class GameServer {
  constructor(redisClient) {
    this.connections = {};
    this.redisClient = redisClient;
    this.server = express();
    this.typeIdx = -1;
    this.vesselPosXRef = 2;
    this.opponentPosXRef = 2;
    expressWs(this.server);
    this.server.get("/hello", (req, res) => res.send("hello my gee\n"));
    this.server.ws("/newGame", this.newGame.bind(this));
  }
  newGame(ws, req) {
    this.initSession(ws, req.headers["playerid"]); //manage session for the new connection
    this.setUpListeners(ws, req.headers["playerid"]); //set liteners for the new connection
  }

  async initSession(ws, playerId) {
    // create/find out a session for the new player
    let playerSession = await this.redisClient.get("availableSession");
    if (!playerSession) {
      const ssId = uuidv4();
      await this.redisClient.set("availableSession", ssId);
      await this.redisClient.set("swich", 0);
      await this.redisClient.set("posXRef", 1);
      playerSession = ssId;
      this.connections[playerSession] = [];
      console.log(`new sessions created, sessions id: ${ssId}`);
    }
    await this.redisClient.sAdd(`session:${playerSession}:GS`, playerId);
    await this.redisClient.sAdd(
      `session:${playerSession}:connections`,
      playerId,
    );
    const conCount = await this.redisClient.sCard(
      `session:${playerSession}:connections`,
    );
    if (conCount === 6) await this.redisClient.del("availableSession");

    //Increment and get the swich variable
    await this.redisClient.incr("swich");
    const swich = await this.redisClient.get("swich");
    const posXRef = await this.redisClient.get("posXRef");

    // Set up user's data and Store it
    const newPlayer = {
      playerId: playerId,
      type: swich % 2 === 0 ? "opponent" : "vessel",
      lp: 100,
    };

    newPlayer.posX = posXRef;
    newPlayer.type === "vessel" ? (newPlayer.posY = 5) : (newPlayer.posY = 0);
    newPlayer.width = objectsSize[newPlayer.type][0];
    newPlayer.heigth = objectsSize[newPlayer.type][1];

    await this.redisClient.set(`player:${playerId}`, JSON.stringify(newPlayer));

    // Set up and store connection's data
    const newConnection = {
      ws: ws,
      playerId: playerId,
      playerType: swich % 2 === 0 ? "opponent" : "vessel",
    };

    this.connections[playerSession].push(newConnection);

    // complete variable updates
    if (swich % 2 === 0 && swich >= 2) {
      await this.redisClient.set(
        "posXRef",
        posXRef + objectsSize[newPlayer.type][0] + 1,
      );
    }

    // Send update message to players
    const GS = this.getGameState(playerSession);
    ws.send(
      JSON.stringify({
        messageType: "unique",
        topic: "init",
        sessionId: playerSession,
        senderId: null,
        content: {
          ssId: playerSession,
          playerType: newPlayer.type,
          initPosX: newPlayer.posX,
          initPosY: newPlayer.posY,
          gameState: GS,
        },
      }),
    );

    this.broadcast(
      JSON.stringify({
        messageType: "broadcast",
        topic: "stateUpdate",
        sessionId: playerSession,
        senderId: playerId,
        content: newPlayer,
      }),
      this.connections[playerSession],
    );
  }

  setUpListeners(ws, playerId) {
    ws.on("message", (msg) => {
      const msgObj = JSON.parse(msg);
      if (msgObj.topic === "stateUpdate") {
        this.sessions[msgObj.sessionId]["referenceGameState"][
          msgObj.content.id
        ] = msgObj.content;
      } else if (msgObj.topic === "shootSomeone") {
        //perform a verification of the shoot and a reference update
        //hasCollide(shift, obj1, obj2);
        delete this.sessions[msgObj.sessionId]["referenceGameState"][
          "undefined"
        ];
        console.log(this.sessions[this.ssId]["referenceGameState"]);
        this.sessions[msgObj.sessionId]["referenceGameState"][
          msgObj.content.id
        ] = msgObj.content;
        msgObj.topic = "shootSomeone";
      } else if (msgObj.topic === "endGame") {
        //Perform necessary verification to ensure the player has been destroyed

        //First we remove the shoot(or the destroyed element) from the RGS and Connections
        delete this.sessions[msgObj.sessionId]["referenceGameState"][
          msgObj.senderId
        ];
        delete this.sessions[msgObj.sessionId]["connections"][msgObj.senderId];
        this.sessions[msgObj.sessionId]["clientCount"] -= 1;
        if (msgObj.target) {
          if (
            msgObj.target.lp === 0 &&
            this.sessions[msgObj.sessionId]["connections"][
              msgObj.target.playerId
            ]
          ) {
            const targetConnection =
              this.sessions[msgObj.sessionId]["connections"][
                msgObj.target.playerId
              ];
            targetConnection.ws.send(
              JSON.stringify({
                messageType: "unique",
                topic: "destroyed",
                sessionId: msgObj.target.sessionId,
                senderId: null,
              }),
            );
            targetConnection.ws.close(1000, "you'v been destroyed =)");
            delete this.sessions[msgObj.sessionId]["connections"][
              msgObj.target.playerId
            ];
            delete this.sessions[msgObj.sessionId]["referenceGameState"][
              msgObj.target.playerId
            ];
            this.sessions[msgObj.sessionId]["clientCount"] -= 1;
          } else {
            if (msgObj.target.type === "shoot") {
              delete this.sessions[msgObj.sessionId]["referenceGameState"][
                msgObj.target.playerId
              ];
            } else {
              this.sessions[msgObj.sessionId]["referenceGameState"][
                msgObj.target.playerId
              ] = msgObj.target;
              this.sessions[msgObj.sessionId]["connections"][
                msgObj.target.playerId
              ].ws.send(
                JSON.stringify({
                  messageType: "unique",
                  topic: "uWereShot",
                  sessionId: this.ssId,
                  senderId: null,
                  content: msgObj.target,
                }),
              );
            }
          }
        }
      } else if (msgObj.topic === "removeShot") {
        msgObj.content.forEach((shootId) => {
          delete this.sessions[msgObj.sessionId]["referenceGameState"][shootId];
        });
      }

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
    if (msgObj.messageType === "broadcast") {
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
  }

  listen(port, callback) {
    this.server.listen(port, callback);
  }

  async getGameState(ssId) {
    const ssElemts = await this.redisClient.sMembers(`session:${ssId}:GS`);
    const multi = this.redisClient.multi();
    const GameState = {};
    ssElemts.forEach((objId) => multi.get(`player:${objId}`));
    const results = await multi.exec();
    ssElemts.forEach((objId, index) => {
      GameState[objId] = JSON.parse(results[index]);
    });
    return GameState;
  }

  // async getConnections(ssId) {
  //   const ssElemts = await this.redisClient.sMembers(
  //     `session:${ssId}:connections`,
  //   );
  //   const multi = this.redisClient.multi();
  //   const connections = [];
  //   ssElemts.forEach((playerId) => multi.get(`connection:${playerId}`));
  //   const results = await multi.exec();
  //   results.map(([error, data]) => {
  //     connections[data.playerId] = JSON.parse(data);
  //   });
  //   return connections;
  // }
}

//Server's redis connection
const redisClient = await createClient({
  url: "redis://localhost:6380/0",
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
redisClient.del("sceneElements");
redisClient.del("shots");

//Launch new server instance
const server = new GameServer(redisClient);
server.listen(3000, () => console.log("Server is listenning"));

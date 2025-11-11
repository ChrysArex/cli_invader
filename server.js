import express from "express";
import expressWs from "express-ws";
import { objectsSize } from "./utils.js";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "redis";
//import { hasCollide } from "./collision.js";

class GameServer {
  constructor(redisClient) {
    //Store the connection objects of the connected clients
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
    this.initSession(ws, req.headers["playerid"]); // manage session for the new connection
    this.setUpListeners(ws, req.headers["playerid"]); //set liteners for the new connection
  }

  async initSession(ws, playerId) {
    // create/find out a session for the new player
    let playerSession = await this.redisClient.get("availableSession");
    if (!playerSession) {
      const ssId = uuidv4();
      await this.redisClient.set("availableSession", ssId);
      await this.redisClient.set("swich", 0);
      await this.redisClient.set("posXRef", 2);
      playerSession = ssId;
      this.connections[playerSession] = [];
      console.log(`new sessions created, sessions id: ${ssId}`);
    }
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
    const posXRef = parseInt(await this.redisClient.get("posXRef"));

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

    await this.redisClient.hSet(
      `session:${playerSession}:players`,
      playerId,
      JSON.stringify(newPlayer),
    );

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

    // Send initialisation message to player
    const GS = await this.redisClient.hGetAll(
      `session:${playerSession}:players`,
    );
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
    // Send update message to other players
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
    ws.on("message", async (msg) => {
      const msgObj = JSON.parse(msg);
      if (msgObj.topic === "stateUpdate") {
        //Update the player's data inside the DB
        await this.redisClient.hSet(
          `session:${msgObj.sessionId}:players`,
          msgObj.content.playerId,
          JSON.stringify(msgObj.content),
        );
      } else if (msgObj.topic === "shootSomeone") {
        //perform a verification of the shoot and a reference update
        //hasCollide(shift, obj1, obj2);
      } else if (msgObj.topic === "exitGame") {
        await this.closeConnection(msgObj.sessionId, msgObj.senderId);
      } else if (msgObj.topic === "removeShot") {
        msgObj.content.forEach((shootId) => {
          delete this.sessions[msgObj.sessionId]["referenceGameState"][shootId];
        });
      }

      this.broadcast(msg, this.connections[msgObj.sessionId]);
      console.log("Message broadcasted");
    });

    ws.on("close", async (code, ssId) => {});
  }

  async closeConnection(ssId, playerId) {
    //Remove player's connection
    let index;
    this.connections[ssId].forEach((conn, idx) => {
      if (conn.playerId === playerId) {
        conn.ws.close(1000, "Player exit the session");
        index = idx;
      }
    });
    this.connections[ssId].splice(index, 1);
    console.log(`Player ${playerId} disconnected`);
    //Remove player's data
    await this.redisClient.hDel(`session:${ssId}:players`, playerId);
    await this.redisClient.sRem(`session:${ssId}:connections`, playerId);
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
  // async getGameState(ssId) {
  //   const ssElemts = await this.redisClient.hGetAll(`session:${ssId}:players`);
  //   let GameState = {};
  //   // for (const [id, value] of Object.values(ssElemts)) {
  //   //   GameState[id] = JSON.parse(value);
  //   // }
  //   for (let [id, obj] of Object.entries(ssElemts)) {
  //     GameState[id] = obj;
  //   }
  //   return GameState;
  // }

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

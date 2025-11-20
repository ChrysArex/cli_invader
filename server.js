import express from "express";
import expressWs from "express-ws";
import { objectsSize } from "./utils.js";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "redis";
import { hasCollide } from "./collision.js";
import { screenYLimit } from "./utils.js";

class GameServer {
  constructor(redisClient) {
    //Store the connection objects of the connected clients
    this.connections = {};
    this.gameState = {};
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
      this.gameState[playerSession] = {};
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

    this.gameState[playerSession][playerId] = newPlayer;

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
        this.gameState[msgObj.sessionId][msgObj.content.playerId] =
          msgObj.content;
      } else if (msgObj.topic === "shoot") {
        //perform a verification of the shoot and a reference update
        //hasCollide(shift, obj1, obj2);
        this.gameState[msgObj.sessionId][msgObj.content.playerId] =
          msgObj.content;
        const intervalID = setInterval(
          () =>
            this.shootManager(
              msgObj.sessionId,
              msgObj.content.playerId,
              intervalID,
            ),
          100,
        );
      } else if (msgObj.topic === "remove") {
        await this.closeConnection(msgObj.sessionId, msgObj.senderId);
      } else if (msgObj.topic === "removeShot") {
        msgObj.content.forEach((shootId) => {
          delete this.sessions[msgObj.sessionId]["referenceGameState"][shootId];
        });
      }

      this.broadcast(msg, this.connections[msgObj.sessionId]);
      console.log("Message broadcasted");
    });
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
    delete this.gameState[ssId][playerId];
    console.log(`Player ${playerId} disconnected`);
    //Remove player's data
    await this.redisClient.hDel(`session:${ssId}:players`, playerId);
    await this.redisClient.sRem(`session:${ssId}:connections`, playerId);
  }

  //Manage shoot creation, evolution and destruction
  async shootManager(ssId, shootId, intervalID) {
    let shoot = this.gameState[ssId][shootId];
    if (shoot.posY !== 0 && shoot.posY !== screenYLimit) {
      const obstacle = Object.values(this.gameState[ssId]).find((obj) => {
        if (obj.playerId !== shoot.playerId) {
          return hasCollide(shoot, obj);
        }
      });
      if (!obstacle) {
        shoot.posY += shoot.direction === "ascendant" ? -1 : 1;
      } else {
        obstacle.lp -= 1;
        console.log(`here is the touched obj ${JSON.stringify(obstacle)}`);
        let objToRemove = [];
        if (obstacle.lp === 0) {
          objToRemove.push(obstacle.playerId);
          delete this.gameState[ssId][obstacle.playerId];
          if (obstacle.type !== "shoot")
            this.closeConnection(ssId, obstacle.playerId);
        } else {
          await this.redisClient.hSet(
            `session:${ssId}:players`,
            obstacle.playerId,
            JSON.stringify(obstacle),
          );
          this.broadcast(
            JSON.stringify({
              messageType: "broadcast",
              topic: "stateUpdate",
              sessionId: ssId,
              senderId: null,
              content: obstacle,
            }),
            this.connections[ssId],
          );
        }
        objToRemove.push(shoot.playerId);
        delete this.gameState[ssId][shoot.playerId];
        this.broadcast(
          JSON.stringify({
            messageType: "broadcast",
            topic: "remove",
            sessionId: ssId,
            senderId: null,
            content: objToRemove,
          }),
          this.connections[ssId],
        );
        clearInterval(intervalID);
        console.log("Message broadcasted");
      }
    } else {
      clearInterval(intervalID);
    }
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

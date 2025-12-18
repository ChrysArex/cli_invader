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
      await this.redisClient.set(`session:${ssId}:vessel`, 0);
      await this.redisClient.set(`session:${ssId}:opponent`, 0);
      await this.redisClient.set("posXRef", 2);
      playerSession = ssId;
      this.connections[playerSession] = [];
      this.gameState[playerSession] = { stage: "WAITING" };
      console.log(`new sessions created, sessions id: ${ssId}`);
    }
    await this.redisClient.sAdd(
      `session:${playerSession}:connections`,
      playerId,
    );
    const conCount = await this.redisClient.sCard(
      `session:${playerSession}:connections`,
    );

    //Increment and get the swich variable
    await this.redisClient.incr("swich");
    const swich = await this.redisClient.get("swich");
    const posXRef = parseInt(await this.redisClient.get("posXRef"));

    //Keep track of the number of player in each team
    swich % 2 === 0
      ? await this.redisClient.incr(`session:${playerSession}:opponent`)
      : await this.redisClient.incr(`session:${playerSession}:vessel`);

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
        notif: `Welcome in the battle`,
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
        notif: `${6 - conCount} player(s) more and we are good to go `,
        content: newPlayer,
      }),
      this.connections[playerSession],
    );
    //We swich mode if the rigth number of connection is hit
    if (conCount === 6) {
      this.gameState[playerSession]["stage"] = "BATTLE";
      await this.redisClient.del("availableSession");
      this.broadcast(
        JSON.stringify({
          messageType: "broadcast",
          topic: "start",
          sessionId: playerSession,
          senderId: null,
          notif: `Get ready to fight`,
        }),
        this.connections[playerSession],
      );
    }
  }

  //Set up a set of condition to enable players to communicate with the server
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
        // if (this.gameState[msgObj.sessionId]["stage"] !== "WAITING") {

        // }
      } else if (msgObj.topic === "remove") {
        await this.closeConnection(
          msgObj.sessionId,
          msgObj.senderId,
          msgObj.playerType,
        );
      } else if (msgObj.topic === "removeShot") {
        msgObj.content.forEach((shootId) => {
          delete this.sessions[msgObj.sessionId]["referenceGameState"][shootId];
        });
      }

      this.broadcast(msg, this.connections[msgObj.sessionId]);
      console.log("Message broadcasted");
    });
  }

  //Manage player deconnection
  async closeConnection(ssId, playerId, playerType) {
    //Remove player's connection
    let index, oppCount, vessCount;
    this.connections[ssId].forEach((conn, idx) => {
      if (conn.playerId === playerId) {
        conn.ws.close(1000, "Player exit the session");
        index = idx;
      }
    });
    //Remove player's data in redis
    if (playerType === "opponent") {
      await this.redisClient.decr(`session:${ssId}:opponent`);
      oppCount = await this.redisClient.get(`session:${ssId}:opponent`);
    } else {
      await this.redisClient.decr(`session:${ssId}:vessel`);
      vessCount = await this.redisClient.get(`session:${ssId}:vessel`);
    }
    await this.redisClient.hDel(`session:${ssId}:players`, playerId);
    await this.redisClient.sRem(`session:${ssId}:connections`, playerId);
    //Remove player's data in server
    this.connections[ssId].splice(index, 1);
    delete this.gameState[ssId][playerId];
    console.log(`Player ${playerId} disconnected`);
    //
    if (vessCount === 0 || oppCount === 2) {
      this.broadcast(
        JSON.stringify({
          messageType: "team",
          topic: "winner",
          playerType: oppCount === 0 ? "vessel" : "opponent",
          sessionId: ssId,
          senderId: null,
          notif: `You won`,
        }),
        this.connections[playerSession],
      );

      this.broadcast(
        JSON.stringify({
          messageType: "team",
          topic: "looser",
          playerType: oppCount === 0 ? "opponent" : "vessel",
          sessionId: ssId,
          senderId: null,
          notif: `You lost`,
        }),
        this.connections[playerSession],
      );
    }
  }

  //Manage shoot creation, evolution and destruction
  async shootManager(ssId, shootId, intervalID) {
    let shoot = this.gameState[ssId][shootId];
    if (shoot && shoot.posY !== 0 && shoot.posY !== screenYLimit) {
      const obstacle = Object.values(this.gameState[ssId]).find((obj) => {
        if (obj.playerId && obj.playerId !== shoot.playerId) {
          return hasCollide({ ...shoot, type: "shoot" }, obj);
        }
      });
      if (!obstacle) {
        shoot.posY += shoot.direction === "ascendant" ? -1 : 1;
      } else {
        obstacle.lp -= 1;
        console.log(`${obstacle.type} is touched`);
        let objToRemove = [];
        if (obstacle.lp === 0) {
          objToRemove.push(obstacle.playerId);
          delete this.gameState[ssId][obstacle.playerId];
          if (obstacle.type !== "shoot")
            this.closeConnection(ssId, obstacle.playerId, obstacle.type);
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
        if (player["playerId"] !== msgObj.senderId) player.ws.send(message);
      });
      return;
    }
    if (msgObj.messageType === "team") {
      players.forEach((player) => {
        if (
          player["playerId"] !== msgObj.senderId &&
          player.playerType === msgObj.playerType
        )
          player.ws.send(message);
      });
      return;
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

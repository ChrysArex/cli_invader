import { WebSocket } from "ws";
import { fork } from "node:child_process";
import { v4 as uuidv4 } from "uuid";
// import figlet from "figlet";
import { hasCollide } from "../collision.js";
import {
  displayScene,
  screenXLimit,
  screenYLimit,
  objectsSize,
  validateGameObject,
  removeFromSceneElements,
  sleep,
} from "../utils.js";
import { console } from "node:inspector/promises";
import { createClient } from "redis";
import { log } from "node:console";

class player {
  constructor(wsClient, id, type = "vessel") {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write("\x1B[?25l");

    //player's ID
    this.id = id;

    //Id of the session the user is in
    this.sessionId = null;

    //life point
    this.lp = 100;

    //X and Y coordinates
    this.posX = 0;
    this.posY = 22;

    //the type of the team the player is in
    this.type = type;

    this.width = objectsSize[this.type][0];
    this.heigth = objectsSize[this.type][1] - 1;

    //the actual connection
    this.client = wsClient;

    //List of all the element present in a frame
    this.sceneElements = {};

    //listennes for incoming messages from server and player
    this.updateBattleState();
    this.enableStarshipNavigation();
  }

  /*
   * This function define the motion mechanism for a player
   * It basically set an listenner for keyboards inputs wich are then used to update the game state
   */
  enableStarshipNavigation() {
    const actions = {
      //escape
      "\x1B": () => {
        this.endBattle();
        return this.id;
      },

      //right move
      "\x1b[C": () => {
        const obstacle = Object.values(this.sceneElements).find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide({ ...this, posX: this.posX + 1 }, obj);
          }
        });

        if (!obstacle && this.posX < screenXLimit - this.width) {
          this.posX += 1;
          this.sceneElements[this.id].posX = this.posX;
        }
        return this.id;
      },

      //left move
      "\x1b[D": () => {
        const obstacle = Object.values(this.sceneElements).find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide({ ...this, posX: this.posX - 1 }, obj);
          }
        });
        if (!obstacle && this.posX >= 1) {
          this.posX -= 1;
          this.sceneElements[this.id].posX = this.posX;
        }
        return this.id;
      },

      //up move
      "\x1b[A": () => {
        const obstacle = Object.values(this.sceneElements).find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide({ ...this, posY: this.posY - 1 }, obj);
          }
        });
        if (!obstacle && this.posY > 0) {
          this.posY -= 1;
          this.sceneElements[this.id].posY = this.posY;
        }
        return this.id;
      },

      //down move
      "\x1b[B": () => {
        const obstacle = Object.values(this.sceneElements).find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide({ ...this, posY: this.posY + 1 }, obj);
          }
        });
        if (!obstacle && this.posY + this.heigth < screenYLimit) {
          this.posY += 1;
          this.sceneElements[this.id].posY = this.posY;
        }

        return this.id;
      },

      //shoot
      " ": () => {
        let theShoot = {
          type: "shoot",
          direction: this.type === "vessel" ? "ascendant" : "descendant",
          playerId: uuidv4(),
          posX: this.posX + this.width / 2 + 1,
          posY: this.type === "vessel" ? this.posY - 1 : this.posY + 3,
          width: objectsSize["shoot"][0],
          heigth: objectsSize["shoot"][1] - 1,
          lp: 1,
        };
        this.sceneElements[theShoot.playerId] = theShoot;

        const intervalID = setInterval(
          () => this.shootManager(theShoot.playerId, intervalID),
          100,
        );
        return theShoot.playerId;
      },
    };
    process.stdin.on("data", async (data) => {
      const action = data.toString();
      if (Object.values(this.sceneElements).length === 0) {
        process.exit();
      } else if (action in actions) {
        const objectID = actions[action]();
        this.client.send(
          JSON.stringify({
            messageType: "broadcast",
            topic: action === " " ? "shoot" : "stateUpdate",
            sessionId: this.sessionId,
            senderId: this.id,
            playerType: action === " " ? "shoot" : this.type,
            content: this.sceneElements[objectID],
          }),
        );
        displayScene(this.sceneElements);
      }
    });
  }

  //listen to incoming message from the server and update the battle view
  //Display new frame for synchronisation
  updateBattleState() {
    this.client.on("message", async (message) => {
      let msg = JSON.parse(message);
      if (msg.topic === "init") {
        this.sessionId = msg.content.ssId;
        this.type = msg.content.playerType;
        this.posX = msg.content.initPosX;
        this.posY = msg.content.initPosY;
        for (let [id, obj] of Object.entries(msg.content.gameState)) {
          this.sceneElements[id] = JSON.parse(obj);
        }
      } else if (msg.topic === "stateUpdate") {
        this.sceneElements[msg.content.playerId] = msg.content;
      } else if (msg.topic === "shoot") {
        this.sceneElements[msg.content.playerId] = msg.content;
        const intervalID = setInterval(
          () => this.shootManager(msg.content.playerId, intervalID),
          100,
        );
      } else if (msg.topic === "remove") {
        msg.content.forEach((id) => delete this.sceneElements[id]);
      } else if (msg.topic === "uWereShot") {
        this.lp = msg.content.lp;
      } else if (msg.topic === "destroyed") {
        this.sceneElements = ["destroyed"];
      }
      displayScene(this.sceneElements);
    });
  }

  //Manage player's deconnection
  endBattle() {
    const answer = displayScene(["exit"]);
    if (answer === "y") {
      this.client.send(
        JSON.stringify({
          messageType: "broadcast",
          topic: "remove",
          sessionId: this.sessionId,
          senderId: this.id,
          playerType: this.type,
          content: [this.id],
        }),
      );
      process.exit();
    } else {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }
  }

  //Manage shoot creation, evolution and destruction
  shootManager(shootId, intervalID) {
    let shoot = this.sceneElements[shootId];
    if (shoot.posY !== 0 && shoot.posY !== screenYLimit) {
      const obstacle = Object.values(this.sceneElements).find((obj) => {
        if (obj.playerId !== shoot.playerId) {
          return hasCollide(shoot, obj);
        }
      });
      if (!obstacle) {
        shoot.posY += shoot.direction === "ascendant" ? -1 : 1;
      } else {
        obstacle.lp -= 1;
        clearInterval(intervalID);
        delete this.sceneElements[shootId];
      }
    } else {
      clearInterval(intervalID);
      delete this.sceneElements[shootId];
    }
    displayScene(this.sceneElements);
  }
}

//Player's ID
const id = uuidv4();

//Player's WebSocket connection
const wsClient = new WebSocket("ws://localhost:3000/newGame", {
  headers: { playerid: id },
});

wsClient.on("open", () => {
  const player0 = new player(wsClient, id);
});

wsClient.on("error", console.error);

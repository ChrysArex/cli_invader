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
    // this.enventLoop();
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
        const self = {
          id: this.id,
          posX: this.posX,
          posY: this.posY,
          type: this.type,
          lp: this.lp,
          width: this.width,
          heigth: this.heigth,
        };
        return self;
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
        const self = {
          id: this.id,
          posX: this.posX,
          posY: this.posY,
          type: this.type,
          lp: this.lp,
          width: this.width,
          heigth: this.heigth,
        };
        return self;
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
        const self = {
          id: this.id,
          posX: this.posX,
          posY: this.posY,
          type: this.type,
          lp: this.lp,
          width: this.width,
          heigth: this.heigth,
        };
        return self;
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
        const self = {
          id: this.id,
          posX: this.posX,
          posY: this.posY,
          type: this.type,
          lp: this.lp,
          width: this.width,
          heigth: this.heigth,
        };
        return self;
      },

      //shoot
      // " ": async () => {
      //   const shootId = uuidv4();
      //   let theShoot = {
      //     type: "shoot",
      //     direction: this.type === "vessel" ? "ascendant" : "descendant",
      //     id: shootId,
      //     posX: this.posX + this.width / 2 + 1,
      //     posY: this.type === "vessel" ? this.posY - 1 : this.posY + 3,
      //     width: objectsSize["shoot"][0],
      //     heigth: objectsSize["shoot"][1] - 1,
      //     lp: 1,
      //   };
      //   this.sceneElements[shootId] = theShoot;
      //   await this.addToSceneElements(theShoot);

      //   await this.redisClient.lPush("shots", shootId);
      //   this.client.send(
      //     JSON.stringify({
      //       messageType: "broadcast",
      //       topic: "shootSomeone",
      //       sessionId: this.sessionId,
      //       senderId: this.id,
      //       authorId: this.id,
      //       type: "shoot",
      //       content: theShoot,
      //     }),
      //   );
      //   return theShoot;
      // },
    };
    process.stdin.on("data", async (data) => {
      const action = data.toString();
      if (Object.values(this.sceneElements).length === 0) {
        process.exit();
      } else if (action in actions) {
        let execData = actions[action]();
        this.client.send(
          JSON.stringify({
            messageType: "broadcast",
            topic: "stateUpdate",
            sessionId: this.sessionId,
            senderId: this.id,
            playerType: this.type,
            content: this.sceneElements[this.id],
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
        // let self = this.sceneElements[this.id];
        // self.posX = this.posX;
        // self.posY = this.posY;
      } else if (msg.topic === "stateUpdate") {
        // if (!validateGameObject(msg.content)) {
        //   console.error("Invalid object received:", msg.content);
        //   return;
        // }
        this.sceneElements[msg.content.playerId] = msg.content;
      } else if (msg.topic === "shootSomeone") {
      } else if (msg.topic === "endGame") {
        delete this.sceneElements[msg.senderId];
      } else if (msg.topic === "uWereShot") {
        this.lp = msg.content.lp;
      } else if (msg.topic === "destroyed") {
        this.sceneElements = ["destroyed"];
      }
      displayScene(this.sceneElements);
    });
  }

  endBattle() {
    const answer = displayScene(["exit"]);
    if (answer === "y") {
      this.client.send(
        JSON.stringify({
          messageType: "broadcast",
          topic: "endGame",
          sessionId: this.sessionId,
          senderId: this.id,
          playerType: this.type,
          content: {},
        }),
      );
      process.exit();
    } else {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }
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

import { WebSocket } from "ws";
import { eraseLines } from "ansi-escapes";
import { v4 as uuidv4 } from "uuid";
import figlet from "figlet";
import readline from "node:readline";
import { hasCollide } from "../collision.js";
import {
  sleep,
  shoot,
  displayScene,
  screenXLimit,
  screenYLimit,
  objectsSize,
} from "../utils.js";
import { console } from "node:inspector/promises";

class player {
  constructor(type = "vessel") {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    //player's ID
    this.id = crypto.randomUUID();

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
    this.client = new WebSocket("ws://localhost:3000/newGame", {
      headers: { playerid: this.id },
    });

    this.client.on("error", console.error);
    // this.client.on("open", this.enableStarshipNavigation);
    this.client.on("close", this.endBattle);

    //List of all the element present in a frame
    this.sceneElements = [];

    this.enableStarshipNavigation();
    this.updateBattleState();
  }

  /*
   * This function define the motion mechanism for a player
   * It basically set an listenner for keyboards inputs wich are then used to update the game state
   */
  enableStarshipNavigation() {
    const actions = {
      //escape
      "\x1B": () => {
        console.log("I am exiting !!!!");
        //this.endBattle();
        process.exit();
      },

      //right move
      "\x1b[C": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide("\x1b[C", { ...this, posX: this.posX + 1 }, obj);
          }
        });

        if (!obstacle && this.posX < screenXLimit - this.width) {
          this.posX += 1;
          this.sceneElements.find((obj) => obj.playerId === this.id).posX =
            this.posX;
        }
      },

      //left move
      "\x1b[D": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide("\x1b[D", { ...this, posX: this.posX - 1 }, obj);
          }
        });
        if (!obstacle && this.posX >= 1) {
          this.posX -= 1;
          this.sceneElements.find((obj) => obj.playerId === this.id).posX =
            this.posX;
        }
      },

      //up move
      "\x1b[A": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide("\x1b[A", { ...this, posY: this.posY - 1 }, obj);
          }
        });
        if (!obstacle && this.posY > 0) {
          this.posY -= 1;
          this.sceneElements.find((obj) => obj.playerId === this.id).posY =
            this.posY;
        }
      },

      //down move
      "\x1b[B": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (obj.playerId !== this.id) {
            return hasCollide("\x1b[B", { ...this, posY: this.posY + 1 }, obj);
          }
        });
        if (!obstacle && this.posY + this.heigth < screenYLimit) {
          this.posY += 1;
          this.sceneElements.find((obj) => obj.playerId === this.id).posY =
            this.posY;
        }
      },

      //shoot
      " ": async () => {
        await shoot(this.sceneElements, this);
      },
    };
    process.stdin.on("data", (data) => {
      const action = data.toString();
      if (action in actions) {
        console.log("print something before leaving");
        actions[data.toString()]();
        //give a copy to the function
        const scene = this.sceneElements.slice();
        //console.log(this.sceneElements);
        displayScene(scene);
        this.client.send(
          JSON.stringify({
            messageType: "broadcast",
            topic: "stateUpdate",
            sessionId: this.sessionId,
            senderId: this.id,
            playerType: this.type,
            content: {
              playerId: this.id,
              posX: this.posX,
              posY: this.posY,
              type: this.type,
              lp: this.lp,
              width: this.width,
              heigth: this.heigth,
            },
          }),
        );
      }
    });
  }

  //listen to incoming message from the server/client and update the battle view
  //Display new frame for synchronisation
  updateBattleState() {
    this.client.on("message", (message) => {
      let msg = JSON.parse(message);
      if (msg.topic === "init") {
        this.sessionId = msg.content.ssId;
        this.type = msg.content.playerType;
        this.posX = msg.content.initPosX;
        this.posY = msg.content.initPosY;
        this.sceneElements = msg.content.gameState;
        let self = this.sceneElements.find((obj) => obj.playerId === this.id);
        self.posX = this.posX;
        self.posY = this.posY;
      } else if (msg.topic === "stateUpdate") {
        this.sceneElements = msg.content;
      } else if (msg.topic === "shootSomeone") {
        this.sceneElements = msg.content;
      } else if (msg.topic === "endGame") {
        this.sceneElements = msg.content;
      }
      displayScene(this.sceneElements);
    });
  }

  endBattle() {
    // this.client.send(
    //   JSON.stringify({
    //     messageType: "broadcast",
    //     topic: "endGame",
    //     sessionId: this.sessionId,
    //     senderId: this.id,
    //     playerType: this.type,
    //     content: {},
    //   }),
    // );
    //process.stdin.setRawMode(true);
    console.clear();
    const endGame = figlet.textSync("Game Over", {
      font: "Graffiti",
      horizontalLayout: "default",
      verticalLayout: "default",
      width: 80,
      whitespaceBreak: true,
    });
    console.log(endGame);
    console.log("Press escape key (esc) to go back to menu");
  }
}

const player0 = new player();

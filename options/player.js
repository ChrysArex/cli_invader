import { WebSocket } from "ws";
import { eraseLines } from "ansi-escapes";
import { v4 as uuidv4 } from "uuid";
import figlet from "figlet";
import { hasCollide } from "../collision.js";
import {
  sleep,
  shoot,
  displayScene,
  screenXLimit,
  screenYLimit,
  objectsSize,
} from "../utils.js";

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
      headers: { playerid: id },
    });

    this.client.on("error", console.error);
    // this.client.on("open", this.enableStarshipNavigation);
    // this.client.on("close", this.endBattle);

    //List of all the element present in a frame
    this.sceneElements = [
      { posX: 8, posY: 0, type: "vessel", lp: 100, width: 13, heigth: 1 },
      { posX: 50, posY: 2, type: "vessel", lp: 100, width: 13, heigth: 1 },
      { posX: 20, posY: 4, type: "opponent", lp: 100, width: 11, heigth: 2 },
      { posX: 2, posY: 2, type: "shoot", lp: 100, width: 0, heigth: 0 },
    ];
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
      "\x1b": () => {
        process.exit();
      },

      //right move
      "\x1b[C": () => {
        const obstacle = this.sceneElements.find((obj) =>
          hasCollide("\x1b[C", { ...this, posX: this.posX + 1 }, obj),
        );

        if (!obstacle && this.posX < screenXLimit - this.width) this.posX += 1;
      },

      //left move
      "\x1b[D": () => {
        const obstacle = this.sceneElements.find((obj) =>
          hasCollide("\x1b[D", { ...this, posX: this.posX - 1 }, obj),
        );
        if (!obstacle && this.posX >= 1) this.posX -= 1;
      },

      //up move
      "\x1b[A": () => {
        const obstacle = this.sceneElements.find((obj) =>
          hasCollide("\x1b[A", { ...this, posY: this.posY - 1 }, obj),
        );
        if (!obstacle && this.posY > 0) this.posY -= 1;
      },

      //down move
      "\x1b[B": () => {
        const obstacle = this.sceneElements.find((obj) =>
          hasCollide("\x1b[B", { ...this, posY: this.posY + 1 }, obj),
        );

        if (!obstacle && this.posY + this.heigth < screenYLimit) this.posY += 1;
      },

      //shoot
      " ": () => {
        shoot(this.sceneElements.slice(), this);
      },
    };
    process.stdin.on("data", (data) => {
      const action = data.toString();
      if (action in actions) {
        actions[data.toString()]();
        //give a copy to the function
        const scene = this.sceneElements.slice();
        scene.push(this);
        displayScene(scene);
        this.client.send(
          JSON.stringify({
            type: action,
            playerType: this.type,
            senderId: this.id,
            sessionId: this.sessionId,
            content: this.scene,
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
      if (msg.type === "init") {
        this.sessionId = msg.ssId;
        this.type = msg.playerType;
        this.posX = initPosX;
        this.posY = initPosY;
      }
      displayScene(msg.content);
    });
  }

  //   endBattle(close) {
  //     const winOrLose = lp > 0 ? "Winner" : "Game Over";
  //     const endGame = figlet.textSync(winOrLose, {
  //       font: "Graffiti",
  //       horizontalLayout: "default",
  //       verticalLayout: "default",
  //       width: 80,
  //       whitespaceBreak: true,
  //     });
  //     console.log(endGame);
  //     process.exit();
  //   }
}

const player0 = new player();

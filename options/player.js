import { WebSocket } from "ws";
import { eraseLines } from "ansi-escapes";
import { v4 as uuidv4 } from "uuid";
import figlet from "figlet";
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
    this.id = uuidv4();

    //life point
    this.lp = 100;

    //X and Y coordinates
    this.posX = 0;
    this.posY = 0;

    //list of object present in the game
    this.sceneElements = [];

    //the type of the player
    this.type = type;

    //the actual connection
    this.client = new WebSocket("ws://localhost:3000/start");

    this.client.on("error", console.error);
    this.client.on("open", this.enableStarshipNavigation);
    this.client.on("message", this.updateBattleState);
    this.client.on("close", this.endBattle);
  }

  /*
   *This function define the motion mechanism for a player
   *It basically set an listenner for keyboards inputs wich are then used to update the game state
   */
  enableStarshipNavigation() {
    const y = [];
    for (let i = 0; i < objectsSize[this.type][1]; i++) y.push(this.posY + i);

    const actions = {
      //escape
      "\x1b": () => {
        process.exit();
      },

      //right move
      "\x1b[C": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (
            obj.posY === y[y.length - 1] &&
            obj.posX === this.posX + Math.trunc(objectsSize[this.type][0] / 2)
          )
            return true;
          if (
            y.slice(0, y.length - 1).includes(obj.posY) &&
            obj.posX === this.posX + objectsSize[this.type][0]
          )
            return true;
          return false;
        });

        if (!obstacle && this.posX < screenXLimit - objectsSize[this.type][0])
          this.posX += 1;
      },

      //left move
      "\x1b[D": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (
            obj.posY === y[y.length - 1] &&
            obj.posX === this.posX + Math.trunc(objectsSize[this.type][0] / 2)
          )
            return true;
          if (
            y.slice(0, y.length - 1).includes(obj.posY) &&
            obj.posX + objectsSize[obj.type][0] === this.posX
          )
            return true;
          return false;
        });
        if (!obstacle && this.posX >= 1) this.posX -= 1;
      },

      //up move
      "\x1b[A": () => {
        const obstacle = this.sceneElements.find((obj) => {
          if (
            obj.posY === y[y.length - 1] &&
            obj.posX === this.posX + Math.trunc(objectsSize[this.type][0] / 2)
          )
            return true;
          if (
            y.slice(0, y.length - 1).includes(obj.posY) &&
            obj.posX + objectsSize[obj.type][0] === this.posX
          )
            return true;
          return false;
        });
        if (!obstacle && this.posY > 0) this.posY -= 1;
      },

      //down move
      "\x1b[B": () => {
        if (this.posY < screenYLimit) this.posY += 1;
      },

      //shoot
      " ": async () => {
        this.client.send(`fire_${id}_${posX}`);
        await shoot(posX);
      },
    };
    process.stdin.on("data", (data) => {
      actions[data];
      displayScene(this.sceneElements);
    });
    this.client.send({ posX: this.posX, posY: this.posY });
  }

  //listen to incoming message from the server/client and update the battle view
  //Display new frame for synchronisation
  updateBattleState(message) {
    const action = message.toString().split("_")[0];
    const senderId = message.toString().split("_")[1];
    const data = message.toString().split("_")[2];
    let laserY = "";
    let shootPosX = "";
    let dammage = 0;
    if (action === "fire") {
      shootPosX = data.split(",")[0];
      laserY = data.split(",")[1] ? data.split(",")[1] : "";
      //adversaryPosX = shootPosX;
    } else if (action === "move" || action === "login") {
      adversaryPosX = data;
    } else if (action === "destroyed") {
      adversaryPosX = "";
      console.log(`${action} received`);
    } else if (action === "win") {
      console.log(`${action} received`);
      this.client.close(1000, "Winner");
    }
    const adversary = adversaryPosX
      ? adversaryPosX +
        "\\\\dest_234//\n" +
        adversaryPosX +
        `***** ****${adversarylp}\n` +
        adversaryPosX +
        "     \\/"
      : "";
    let space = "\n";
    let laser = laserY ? laserY + shootPosX + "|" : "";
    for (let i = 0; i < 12 - laserY.length; i = i + 1) {
      space = space + "\n";
    }
    if (
      laser &&
      laserY.length === 12 &&
      shootPosX.length >= posX.length &&
      shootPosX.length <= posX.length + 10
    ) {
      lp = lp - 1;
      laser = laserY;

      //todo dammage representation
      this.vessel = getStarship(this.posX, this.posY, this.lp, "vessel");
    }
    console.clear();
    console.log(adversary + laser + space + this.vessel);
    if (lp === 0) {
      this.client.send(`destroyed_${id}_${posX}`);
    }
    this.vessel = getStarship(this.posX, this.posY, this.lp, "vessel");
  }

  endBattle(close) {
    const winOrLose = lp > 0 ? "Winner" : "Game Over";
    const endGame = figlet.textSync(winOrLose, {
      font: "Graffiti",
      horizontalLayout: "default",
      verticalLayout: "default",
      width: 80,
      whitespaceBreak: true,
    });
    console.log(endGame);
    process.exit();
  }
}

const player = new player();

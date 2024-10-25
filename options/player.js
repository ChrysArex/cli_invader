import { WebSocket } from "ws";
import { eraseLines } from "ansi-escapes";
import { v4 as uuidv4 } from "uuid";
import figlet from "figlet";
import { sleep, shoot, displayScene } from "../utils.js";

class player {
  constructor() {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    //player's ID
    this.id = uuidv4();

    //adversary and self life point
    this.lp = 100;
    this.adversarylp = 100;

    //adversary and self horizontal position
    this.adversaryPosX = "";
    this.posX = "";

    //adversary and self vertical position
    this.adversaryPosY = "";
    this.posY = "";

    //starship of the player
    //this.vessel = getStarship(this.posX, this.posY, this.lp, "vessel");

    //the actual connection
    this.client = new WebSocket("ws://localhost:3000/start");

    this.client.on("open", this.launchStarshipNavigation);
    this.client.on("message", this.updateBattleState);
    this.client.on("close", this.endBattle);
  }

  launchStarshipNavigation() {
    this.client.send(`login_${id}_${posX}`);
    //todo: make a request to get all object states
    console.log(this.vessel); // Display frames showing the state of the whole game
    process.stdin.on("data", async (data) => {
      if (data.toString() === "\u001b") {
        process.exit();
      } else if (data.toString() === "\x1b[C") {
        if (posX.length <= 60) {
          posX = posX + " ";
        }
      } else if (data.toString() === "\x1b[D") {
        if (posX.length >= 1) {
          posX = posX.slice(0, posX.length - 1);
        } else if (data.toString() === " ") {
          this.client.send(`fire_${id}_${posX}`);
          await shoot(posX);
        }
      }
      let space = "\n\n\n\n\n\n\n\n\n\n\n\n\n";
      this.vessel = getStarship(this.posX, this.posY, this.lp, "vessel");
      let adversary =
        adversaryPosX !== ""
          ? getStarship(this.posX, this.posY, this.lp, "vessel")
          : "";
      console.clear();
      console.log(adversary + space + this.vessel);
      this.client.send(`move_${id}_${posX}`);
    });
  }

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

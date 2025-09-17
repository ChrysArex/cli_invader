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
  constructor(redisClient, wsClient, id, type = "vessel") {
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

    //the redis client connection
    this.redisClient = redisClient;

    // this.redisClient.del("sceneElements");
    // this.redisClient.del("shots");

    //List of all the element present in a frame
    this.sceneElements = {};
    this.redisClient.hSet(
      "sceneElements",
      this.id,
      JSON.stringify({
        id: this.id,
        posX: this.posX,
        posY: this.posY,
        type: this.type,
        lp: this.lp,
        width: this.width,
        heigth: this.heigth,
        playerId: this.id,
      }),
    );

    //the actual connection
    this.client = wsClient;

    //listennes for incoming messages from server and player
    this.updateBattleState();
    this.enableStarshipNavigation();

    this.enventLoop();
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
      " ": async () => {
        const shootId = uuidv4();
        let theShoot = {
          type: "shoot",
          direction: this.type === "vessel" ? "ascendant" : "descendant",
          id: shootId,
          posX: this.posX + this.width / 2 + 1,
          posY: this.type === "vessel" ? this.posY - 1 : this.posY + 3,
          width: objectsSize["shoot"][0],
          heigth: objectsSize["shoot"][1] - 1,
          lp: 1,
        };
        this.sceneElements[shootId] = theShoot;
        await this.addToSceneElements(theShoot);

        await this.redisClient.lPush("shots", shootId);
        this.client.send(
          JSON.stringify({
            messageType: "broadcast",
            topic: "shootSomeone",
            sessionId: this.sessionId,
            senderId: this.id,
            authorId: this.id,
            type: "shoot",
            content: theShoot,
          }),
        );
        return theShoot;
      },
    };
    process.stdin.on("data", async (data) => {
      const action = data.toString();
      this.sceneElements = await this.getAllSceneElements();
      if (Object.values(this.sceneElements).length === 0) {
        process.exit();
      } else if (action in actions) {
        let execData = actions[action]();
        await this.redisClient.hSet(
          "sceneElements",
          this.id,
          JSON.stringify({
            id: this.id,
            posX: this.posX,
            posY: this.posY,
            type: this.type,
            lp: this.lp,
            width: this.width,
            heigth: this.heigth,
            playerId: this.id,
          }),
        );

        if (action !== "\x1B") {
          this.client.send(
            JSON.stringify({
              messageType: "broadcast",
              topic: "stateUpdate",
              sessionId: this.sessionId,
              senderId: this.id,
              playerType: this.type,
              content: execData,
            }),
          );
        }
      }
    });
  }

  //listen to incoming message from the server and update the battle view
  //Display new frame for synchronisation
  updateBattleState() {
    this.client.on("message", async (message) => {
      let msg = JSON.parse(message);
      this.sceneElements = await this.getAllSceneElements();
      if (msg.topic === "init") {
        this.sessionId = msg.content.ssId;
        this.type = msg.content.playerType;
        this.posX = msg.content.initPosX;
        this.posY = msg.content.initPosY;
        this.sceneElements = msg.content.gameState;
        const multi = this.redisClient.multi();
        for (const [id, element] of Object.entries(msg.content.gameState)) {
          multi.hSet("sceneElements", id, JSON.stringify(element));
        }
        await multi.exec();
        let self = this.sceneElements[this.id];
        self.posX = this.posX;
        self.posY = this.posY;
      } else if (msg.topic === "stateUpdate") {
        if (!validateGameObject(msg.content)) {
          console.error("Invalid object received:", msg.content);
          return;
        }
        this.sceneElements[msg.content.id] = msg.content;
        await this.redisClient.hSet(
          "sceneElements",
          msg.content.id,
          JSON.stringify(msg.content),
        );
      } else if (msg.topic === "shootSomeone") {
        // let shots = JSON.parse(await this.redisClient.get("shots"));
        //shots.push(msg.content);
        await this.addToSceneElements(msg.content);
        await this.redisClient.lPush("shots", msg.content.id);
      } else if (msg.topic === "endGame") {
        delete this.sceneElements[msg.senderId];
        await this.redisClient.hDel("sceneElements", msg.senderId);
      } else if (msg.topic === "uWereShot") {
        this.lp = msg.content.lp;
      } else if (msg.topic === "destroyed") {
        this.sceneElements = ["destroyed"];
        await this.redisClient.del("sceneElements");
        await this.redisClient.del("shots");
      }
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
      this.redisClient.del("sceneElements");
      this.redisClient.del("shots");
      process.exit();
    } else {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }
  }

  async enventLoop() {
    while (1) {
      const shots = await this.redisClient.lRange("shots", 0, -1);

      let sceneElements = await this.getAllSceneElements();

      // Process shots
      const shotsToRemove = [];
      const shotsToUpdate = {};
      const elementsToUpdate = {};
      const elementsToRemove = [];

      shots.forEach((shootId, index) => {
        const shot = sceneElements[shootId];
        if (shot.direction === "ascendant" && shot.posY <= 0) {
          shotsToRemove.push(shootId);
          elementsToRemove.push(shootId);
        } else if (
          shot.direction === "descendant" &&
          shot.posY >= screenYLimit
        ) {
          shotsToRemove.push(shootId);
          elementsToRemove.push(shootId);
        } else {
          let target = Object.values(sceneElements).find((elmt) =>
            hasCollide(elmt, shot),
          );

          if (target) {
            target.lp -= 1;
            if (target.lp === 0) {
              elementsToRemove.push(target.id);
              //TO-DO: Send a message or find a way to make the
              // server and everyone know that someone has been destroyed
            } else {
              elementsToUpdate[target.id] = { lp: target.lp };
            }
            shotsToRemove.push(shootId);
            elementsToRemove.push(shootId);
          }
          shot.posY += shot.direction === "ascendant" ? -1 : 1;
          elementsToUpdate[shootId] = { posY: shot.posY };
        }
      });

      //Remove shot in the server
      this.client.send(
        JSON.stringify({
          messageType: "broadcast",
          topic: "removeShot",
          sessionId: this.sessionId,
          senderId: this.id,
          playerType: this.type,
          content: shotsToRemove,
        }),
      );

      // Apply all changes atomically
      const multi = this.redisClient.multi();

      // Update elements
      for (const [elementId, updates] of Object.entries(elementsToUpdate)) {
        const currentData = await this.redisClient.hGet(
          "sceneElements",
          elementId,
        );
        if (currentData) {
          const element = JSON.parse(currentData);
          const updatedElement = { ...element, ...updates };
          multi.hSet(
            "sceneElements",
            elementId,
            JSON.stringify(updatedElement),
          );
        }
      }

      // Remove shots
      shotsToRemove.forEach((shootId) => {
        multi.lRem("shots", 0, shootId);
        multi.hDel("sceneElements", shootId);
      });

      await multi.exec();

      sceneElements = await this.getAllSceneElements();
      displayScene(sceneElements);
      await sleep(27);
    }
  }

  async getAllSceneElements() {
    const allElements = await this.redisClient.hGetAll("sceneElements");
    const sceneElements = {};

    for (const [id, elementJson] of Object.entries(allElements)) {
      sceneElements[id] = JSON.parse(elementJson);
    }

    return sceneElements;
  }

  async updateInSceneElements(elementId, updates) {
    const currentData = await this.redisClient.hGet("sceneElements", elementId);
    if (currentData) {
      const element = JSON.parse(currentData);
      const updatedElement = { ...element, ...updates };
      await this.redisClient.hSet(
        "sceneElements",
        elementId,
        JSON.stringify(updatedElement),
      );
    }
  }

  async addToSceneElements(newElement) {
    await this.redisClient.hSet(
      "sceneElements",
      newElement.id,
      JSON.stringify(newElement),
    );
  }
}

//Player's ID
const id = uuidv4();

//Player's redis connection
const redisClient = await createClient({
  url: "redis://localhost:6380/0",
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
redisClient.del("sceneElements");
redisClient.del("shots");

//Player's WebSocket connection
const wsClient = new WebSocket("ws://localhost:3000/newGame", {
  headers: { playerid: id },
});
wsClient.on("error", console.error);

wsClient.on("open", () => {
  const player0 = new player(redisClient, wsClient, id);
});

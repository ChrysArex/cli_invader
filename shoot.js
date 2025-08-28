import { sleep } from "./utils.js";
import { hasCollide } from "./collision.js";
import { createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import {
  displayScene,
  // screenXLimit,
  screenYLimit,
  objectsSize,
} from "./utils.js";

class Shot {
  constructor(redisClient) {
    this.processId = uuidv4();
    this.client = new WebSocket("ws://localhost:3000/newShot", {
      headers: { playerid: this.processId },
    });
    this.redisClient = redisClient;
    this.sceneElements = {};

    this.setListener();
  }

  setListener() {
    process.on("message", async (args) => {
      if (args.topic === "ping") {
        process.send({ topic: "pong" });
      } else if (args.topic === "stateUpdate") {
        // this.sceneElements = args.content.sceneElements;
        // await this.redisClient.set(
        //   "sceneElements",
        //   JSON.stringify(args.content.sceneElements),
        // );
      } else if (args.topic === "shoot") {
        this.shoot(args.content.objReference);
      }
    });
  }

  //Represent shoots in the scene and manage their states
  async shoot(vessel) {
    const id = uuidv4();
    const theShoot = {
      type: "shoot",
      id: id,
      posX: vessel.posX + vessel.width / 2 + 1,
      posY: vessel.type === "vessel" ? vessel.posY - 1 : vessel.posY + 3,
      width: objectsSize["shoot"][0],
      heigth: objectsSize["shoot"][1] - 1,
      lp: 1,
    };
    this.client.send(
      JSON.stringify({
        messageType: "broadcast",
        topic: "shootSomeone",
        sessionId: vessel.sessionId,
        senderId: id,
        authorId: vessel.id,
        playerType: "shoot",
        content: theShoot,
      }),
    );
    let target = null;
    let sceneElements = JSON.parse(await this.redisClient.get("sceneElements"));
    sceneElements[id] = theShoot;
    await this.redisClient.set("sceneElements", JSON.stringify(sceneElements));
    while (
      vessel.type === "vessel"
        ? theShoot.posY > 0
        : theShoot.posY < screenYLimit
    ) {
      // console.log(this.sceneElements);
      // await sleep(5000);
      displayScene(sceneElements);

      await sleep(100);

      target = Object.values(sceneElements).find((elmt) =>
        hasCollide(elmt, theShoot),
      );

      if (target) {
        sceneElements = JSON.parse(await this.redisClient.get("sceneElements"));
        target.lp -= 1;
        await this.redisClient.set(
          "sceneElements",
          JSON.stringify(sceneElements),
        );
        if (target.lp === 0) {
          sceneElements = JSON.parse(
            await this.redisClient.get("sceneElements"),
          );
          delete sceneElements[target.playerId];
          await this.redisClient.set(
            "sceneElements",
            JSON.stringify(sceneElements),
          );
        }
        break;
      }
      theShoot.posY += vessel.type === "vessel" ? -1 : 1;

      sceneElements = JSON.parse(await this.redisClient.get("sceneElements"));
      sceneElements[id].posY = theShoot.posY;
      await this.redisClient.set(
        "sceneElements",
        JSON.stringify(sceneElements),
      );

      this.client.send(
        JSON.stringify({
          messageType: "broadcast",
          topic: "shootSomeone",
          sessionId: vessel.sessionId,
          senderId: id,
          authorId: vessel.id,
          playerType: "shoot",
          content: theShoot,
        }),
      );
    }

    sceneElements = JSON.parse(await this.redisClient.get("sceneElements"));
    delete sceneElements[id];
    await this.redisClient.set("sceneElements", JSON.stringify(sceneElements));
    displayScene(sceneElements);
    this.client.send(
      JSON.stringify({
        messageType: "broadcast",
        topic: "endGame",
        sessionId: vessel.sessionId,
        senderId: id,
        authorId: vessel.id,
        playerType: "shoot",
        content: theShoot,
        target: target,
      }),
    );
  }
}

const redisClient = await createClient({
  url: "redis://localhost:6380/0",
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

const shot = new Shot(redisClient);

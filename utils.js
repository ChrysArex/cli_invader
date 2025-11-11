import { hasCollide } from "./collision.js";
import { question } from "readline-sync";
import figlet from "figlet";

export const screenXLimit = 150;
export const screenYLimit = 25;

//these sizes refer to how much unit I have to add to the X or Y component to get the end coordinates
export const objectsSize = {
  //object: [width, height]
  vessel: [13, 2],
  opponent: [11, 3],
  shoot: [0, 1],
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSubFrameRepr(horizontalElmts, posYReference) {
  let subframe = "\n".repeat(Math.abs(horizontalElmts[0].posY - posYReference));
  //here we define a fix length for subframe
  let line = " ".repeat(screenXLimit);
  let posXReference = 0;
  let offset = 0;
  horizontalElmts.forEach((elmt, index) => {
    let lifePointRepr = elmt.lp.toString();
    if (lifePointRepr.length === 2) {
      lifePointRepr = `0${lifePointRepr}`;
    } else if (lifePointRepr.length === 1) {
      lifePointRepr = `00${lifePointRepr}`;
    }
    if (index > 0) {
      offset = posXReference;
    }

    const GLYPH = {
      vessel: [`${lifePointRepr}____/\\____`, `  /||||  ||||\\`],
      opponent: [`\\\\dest_234//`, `***** ****${lifePointRepr}`, `\\/`],
      shoot: `||`,
    };

    let repr =
      elmt?.part !== undefined ? GLYPH[elmt.type][elmt.part] : GLYPH[elmt.type];
    //we add the representation of the element at his X coordinate and
    //copie the left and rigth part from the previous representation of the line
    let shift = 0;
    if (elmt.type === "opponent" && elmt.part === 2) {
      shift = 5;
    }

    line =
      line.slice(0, elmt.posX + shift) +
      repr +
      line.slice(elmt.posX + shift + repr.length, screenXLimit);
    posXReference = elmt.posX;
  });
  subframe += line;
  return subframe;
}

// This function is responsible to render a consistent representation of the game state across all players (Frame)
export function displayScene(GS) {
  let gameState = Object.values(GS).slice();
  if (gameState.length === 1 && gameState[0] === "exit") {
    console.clear();
    const answer = question("Do you really want to leave the party ? (y/n)");
    return answer;
  } else if (gameState.length === 1 && gameState[0] === "destroyed") {
    console.clear();
    const d = "test";
    const stats = `You have been killed by: ${d} \nkills: ${d} \nshots: ${d} \ndammages: ${d} \n`;
    const endGame = figlet.textSync("Game Over", {
      font: "Graffiti",
      horizontalLayout: "default",
      verticalLayout: "default",
      width: 80,
      whitespaceBreak: true,
    });
    console.log(endGame);
    console.log(stats);
    console.log("Press any key to exit");
    return;
  }

  let sceneElements = gameState;
  let finalFrame = "";
  let groupedElements = [];

  //First we cut out multi-line element in sub-object
  for (let i = 0; i < sceneElements.length; i += 1) {
    let chunckNumber = objectsSize[sceneElements[i].type][1];
    if (chunckNumber > 1) {
      for (let j = 0; j < chunckNumber; j++) {
        sceneElements.splice(i + j, 0, { ...sceneElements[i], part: j });
        if (j > 0) sceneElements[i + j].posY += j;
      }
      sceneElements.splice(i + chunckNumber, 1);
      i += chunckNumber - 1;
    }
  }
  //Then we groupe the elements with the same Y coordinate
  let sceneElementsCopie = [...sceneElements];
  sceneElements.forEach((elmt) => {
    let band = [];
    const loopCount = sceneElementsCopie.length;
    for (let i = 0; i < loopCount; i += 1) {
      if (sceneElementsCopie[i] && sceneElementsCopie[i].posY === elmt.posY) {
        band.push(sceneElementsCopie[i]);
        delete sceneElementsCopie[i];
      }
    }
    if (band.length !== 0) {
      band.push(band[0].posY);
      groupedElements.push(band);
    }
  });
  //The grouped elements are sorted by ascending Y value
  groupedElements.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
  let posYReference = 0;
  //We get each sub-frame's representation and add it to the final frame representing the scene
  groupedElements.forEach((verticallySortedElmt) => {
    verticallySortedElmt.splice(verticallySortedElmt.length - 1, 1);
    verticallySortedElmt.sort((a, b) => a.posX - b.posX);
    finalFrame += getSubFrameRepr(verticallySortedElmt, posYReference);
    posYReference = verticallySortedElmt[0].posY;
  });
  console.clear();
  console.log(finalFrame);
}

// displayScene([
//   { posX: 8, posY: 0, type: "vessel", lp: 100 },
//   { posX: 20, posY: 4, type: "opponent", lp: 100 },
//   { posX: 2, posY: 2, type: "shoot", lp: 100 },
//   { posX: 25, posY: 2, type: "vessel", lp: 100 },
//   { posX: 5, posY: 3, type: "vessel", lp: 100 },
//   { posX: 12, posY: 7, type: "vessel", lp: 100 },
// ]);

export function validateGameObject(obj) {
  return (
    obj &&
    obj.id &&
    obj.type &&
    obj.posX !== undefined &&
    obj.posY !== undefined
  );
}
export async function addToSceneElements(newElement) {
  await this.redisClient.hSet(
    "sceneElements",
    newElement.id,
    JSON.stringify(newElement),
  );
}

export async function removeFromSceneElements(elementId) {
  await this.redisClient.hDel("sceneElements", elementId);
}

export async function updateInSceneElements(elementId, updates) {
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

export async function getAllSceneElements() {
  const allElements = await this.redisClient.hGetAll("sceneElements");
  const sceneElements = {};

  for (const [id, elementJson] of Object.entries(allElements)) {
    sceneElements[id] = JSON.parse(elementJson);
  }

  return sceneElements;
}

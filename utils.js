export const screenXLimit = 60;
export const screenYLimit = 25;

//these sizes refer to how much unit I have to add to the X or Y copmonent the get the end coordinates
export const objectsSize = {
  vessel: [13, 2],
  opponent: [11, 3],
  shoot: [0, 1],
};

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSubFrameRepr(horizontalElmts, posYReference) {
  let subframe = "\n".repeat(horizontalElmts[0].posY - posYReference);
  //here we define a fix length for subframe
  let line = " ".repeat(screenXLimit);
  let posXReference = 0;
  let offset = 0;
  horizontalElmts.forEach((elmt, index, array) => {
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
      opponent: [`\\\\dest_234//`, `***** ****${lifePointRepr}`, `     \\/`],
      shoot: `|`,
    };
    let repr =
      elmt?.part !== undefined ? GLYPH[elmt.type][elmt.part] : GLYPH[elmt.type];
    //we add the representation of the element at his X coordinate and
    //copie the left and rigth part from the previous representation of the line
    line =
      line.slice(0, elmt.posX) +
      repr +
      line.slice(elmt.posX + repr.length, screenXLimit);
    posXReference = elmt.posX;
  });
  subframe += line;
  return subframe;
}

// This is the state manager responsible to render a consistent representation of the game state across all players (Frame)
export function displayScene(sceneElements) {
  //console.log(sceneElements);
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
  //We get each sub-frame's representation and add it to the final frame representing the sce
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
//   // { posX: 8, posY: 0, type: "vessel", lp: 100 },
//   // { posX: 20, posY: 4, type: "opponent", lp: 100 },
//   // { posX: 2, posY: 2, type: "shoot", lp: 100 },
//   // { posX: 25, posY: 2, type: "vessel", lp: 100 },
//   // { posX: 5, posY: 3, type: "vessel", lp: 100 },
//   { posX: 12, posY: 7, type: "vessel", lp: 100 },
// ]);

export async function shoot(data) {
  let laserY = "\n\n\n\n\n\n\n\n\n\n\n";
  data = data + "      ";
  while (laserY.length !== 0) {
    laserY = laserY.slice(0, laserY.length - 1);
    let adversary =
      adversaryPosX !== ""
        ? adversaryPosX +
          "\\\\dest_234//\n" +
          adversaryPosX +
          `***** ****${adversarylp}\n` +
          adversaryPosX +
          "     \\/"
        : "";
    let laser = laserY ? laserY + data + "|" : "";
    let space = "\n";
    for (let i = 0; i < 12 - laserY.length; i = i + 1) {
      space = space + "\n";
    }
    if (
      laserY.length === 0 &&
      data.length >= adversaryPosX.length &&
      data.length <= adversaryPosX.length + 10
    ) {
      adversarylp = adversarylp - 1;
      laser = laserY;
      adversary =
        adversaryPosX !== ""
          ? adversaryPosX +
            "\\\\dest_234//\n" +
            adversaryPosX +
            `* * * * * * * * *${adversarylp}\n` +
            adversaryPosX +
            "     /\\"
          : "";
      console.clear();
      console.log(adversary + laser + space + this.vessel);
      await sleep(200);
      adversary =
        adversaryPosX +
        "\\\\dest_234//\n" +
        adversaryPosX +
        `***** ****${adversarylp}\n` +
        adversaryPosX +
        "     \\/";
    }
    if (adversarylp === 0) {
      this.client.close();
    }
    console.clear();
    console.log(adversary + laser + space + this.vessel);
    await sleep(100);
  }
}

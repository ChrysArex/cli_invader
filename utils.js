export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const objectsYSize = {
  vessel: 2,
  opponent: 3,
  shoot: 1,
};

function getSubFrameRepr(horizontalElmts, posYReference) {
  console.log(horizontalElmts);
  console.log("length of the element", horizontalElmts.length);
  let subframe = "\n".repeat(horizontalElmts[0].posY - posYReference);
  let posXReference = 0;
  horizontalElmts.forEach((elmt) => {
    let lifePointRepr = elmt.lp.toString();
    if (lifePointRepr.length === 2) {
      lifePointRepr = `0${lifePointRepr}`;
    } else if (lifePointRepr.length === 1) {
      lifePointRepr = `00${lifePointRepr}`;
    }

    const GLYPH = {
      vessel: [`${lifePointRepr}____/\\____`, `  /||||  ||||\\`],
      opponent: [`\\\\dest_234//`, `***** ****${lifePointRepr}`, `     \\/`],
      shoot: `|`,
    };
    console.log("value of part", elmt?.part);
    subframe +=
      elmt?.part !== undefined
        ? " ".repeat(elmt.posX - posXReference) + GLYPH[elmt.type][elmt.part]
        : " ".repeat(elmt.posX - posXReference) + GLYPH[elmt.type];
    posXReference = elmt.posX;
  });
  // const { posX, posY, lp, type } = stateObj;
  // const posXRepr = " ".repeat(posX - posXReference);

  // const vessel =
  //   posXRepr + `${lifePointRepr}____/\\____\n` + posXRepr + "  /||||  ||||\\";

  // const adversary =
  //   posXRepr +
  //   "\\\\dest_234//\n" +
  //   posXRepr +
  //   `***** ****${lifePointRepr}\n` +
  //   posXRepr +
  //   "     \\/";

  // const starshipsCatalog = {
  //   vessel,
  //   adversary,
  // };

  return subframe;
}

//console.log(getSubFrameRepr("", "", 0, "vessel"));

// This is the state manager responsible to render a consistent representation of the game state across all players
export function displayScene(sceneElements) {
  let finalFrame = "";
  let groupedElements = [];
  for (let i = 0; i < sceneElements.length; i += 1) {
    let chunckNumber = objectsYSize[sceneElements[i].type];
    if (chunckNumber > 1) {
      for (let j = 0; j < chunckNumber; j++) {
        sceneElements.splice(i + j, 0, { ...sceneElements[i], part: j });
        if (j > 0) sceneElements[i + j].posY += j;
      }
      sceneElements.splice(i + chunckNumber, 1);
      i += chunckNumber - 1;
    }
  }

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

  groupedElements.sort((a, b) => a[a.length - 1] - b[b.length - 1]);
  let posYReference = 0;

  console.log(groupedElements);
  groupedElements.forEach((verticallySortedElmt) => {
    verticallySortedElmt.splice(verticallySortedElmt.length - 1, 1);
    verticallySortedElmt.sort((a, b) => a.posX - b.posX);
    finalFrame += getSubFrameRepr(verticallySortedElmt, posYReference);
    posYReference = verticallySortedElmt[0].posY;
  });
  // groupedElements.forEach((elmt) => {
  //   for (let i = 0; i < elmt.length; i += 1) {
  //     let chunckNumber = objectsYSize[elmt[i].type];
  //     if (chunckNumber > 1) {
  //       for (let j = 0; j < chunckNumber; j++) {
  //         //change de Y value after the part 0
  //         elmt.splice(i + j, 0, { ...elmt[i], part: j });
  //         if (j > 0) elmt[i + j].posY += j;
  //       }
  //       let d = elmt.splice(i + chunckNumber, 1);
  //       i += chunckNumber - 1;
  //     }
  //   }
  //   idx += 1;
  // });
  // finalFrame += getSubFrameRepr(elmt);
  // //console.log(groupedElements);
  //console.clear();
  console.log(finalFrame);
}

displayScene([
  { posX: 2, posY: 3, type: "vessel", lp: 100 },
  { posX: 8, posY: 0, type: "vessel", lp: 100 },
  { posX: 20, posY: 2, type: "opponent", lp: 100 },
  { posX: 9, posY: 7, type: "vessel", lp: 100 },
  { posX: 2, posY: 2, type: "shoot", lp: 100 },
  { posX: 25, posY: 2, type: "vessel", lp: 100 },
]);

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

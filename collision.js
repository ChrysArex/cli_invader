import { objectsSize } from "./utils.js";

//
const shapeRef = {
  vessel: ["cannon", "body1"],
  opponent: ["body1", "body2", "cannon"],
  shoot: ["shoot"],
};

//This function take an object and return his rectangle form
// a matrix representing each part of the object by his coordinates
function rectanglify(obj) {
  let partsNumber = objectsSize[obj.type][1];
  let rectangleForm = [];
  for (let i = 0; i < partsNumber; i++) {
    if (shapeRef[obj.type][i] === "cannon") {
      const x1 = obj.posX + objectsSize[obj.type][0] / 2;
      const x2 = x1 + 1;
      const y = obj.posY + i;
      rectangleForm.push([x1, x2, y, y]);
    } else {
      const x1 = obj.posX;
      const x2 = x1 + objectsSize[obj.type][0];
      const y = obj.posY + i;
      rectangleForm.push([x1, x2, y, y]);
    }
  }
  return rectangleForm;
}

//Check if two rectangles are overlapping [A, A', B, B']
function areOvrlapping(rec1, rec2) {
  return (
    rec1[2] <= rec2[3] &&
    rec1[3] >= rec2[2] &&
    rec1[1] >= rec2[0] &&
    rec1[0] < rec2[1]
  );
}
//This function check if obj1 and obj2 collide
//Return True if they collide, False otherwise
export function hasCollide(obj1, obj2) {
  let test = false;
  //We first rectanglify each object
  const rectFormObj1 = rectanglify(obj1);
  const rectFormObj2 = rectanglify(obj2);

  //Then we check if there is any overlapping parts
  rectFormObj1.forEach((part1) => {
    for (let part2 of rectFormObj2) {
      if (areOvrlapping(part1, part2)) test = true;
    }
  });
  return test;
}

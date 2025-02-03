//This function check if obj1 and obj2 collide
//Return True if they collide, False otherwwise
export function hasCollide(shift, obj1, obj2) {
  const middleReference = obj2.posX + obj2.width / 2;
  const test = {
    opponent:
      obj1.posY === obj2.posY + obj2.heigth &&
      (obj1.posX + obj1.width < middleReference || obj1.posX > middleReference),

    vessel:
      obj1.posY + obj1.heigth === obj2.posY &&
      (obj1.posX + obj1.width < middleReference || obj1.posX > middleReference),
  };

  if (
    obj1.posY <= obj2.posY + obj2.heigth &&
    obj1.posY + obj1.heigth >= obj2.posY &&
    obj1.posX + obj1.width >= obj2.posX &&
    obj1.posX < obj2.posX + obj2.width
  ) {
    if (test[obj2.type]) return false;
    return true;
  }
  return false;
}

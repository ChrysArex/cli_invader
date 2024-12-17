export function hasCollide(shift, obj1, obj2) {
  const test = {
    //right move
    "\x1b[C":
      obj1.posY <= obj2.posY + obj2.heigth &&
      obj1.posY + obj1.heigth >= obj2.posY &&
      obj1.posX + obj1.width >= obj2.posX &&
      obj1.posX < obj2.posX + obj2.width,
    //left move
    "\x1b[D":
      obj1.posY <= obj2.posY + obj2.heigth &&
      obj1.posY + obj1.heigth >= obj2.posY &&
      obj1.posX <= obj2.posX + obj2.width &&
      obj1.posX + obj1.width > obj2.posX,
    //up move
    "\x1b[A":
      obj1.posX <= obj2.posX + obj2.width &&
      obj1.posX + obj1.width > obj2.posX &&
      obj1.posY <= obj2.posY + obj2.heigth &&
      obj1.posY + obj1.heigth > obj2.posY,
    //down move
    "\x1b[B":
      obj1.posX <= obj2.posX + obj2.width &&
      obj1.posX + obj1.width >= obj2.posX &&
      obj1.posY + obj1.heigth >= obj2.posY &&
      obj1.posY <= obj2.posY + obj2.heigth,

    //shoot
    " ":
      obj1.posX <= obj2.posX + obj2.width &&
      obj1.posX + obj1.width >= obj2.posX &&
      obj1.posY + obj1.heigth >= obj2.posY &&
      obj1.posY <= obj2.posY + obj2.heigth,
  };

  if (test[shift]) {
    const middleReference = obj2.posX + obj2.width / 2;
    if (
      obj2.type === "opponent" &&
      obj1.posY === obj2.posY + obj2.heigth &&
      (obj1.posX + obj1.width < middleReference || obj1.posX > middleReference)
    )
      return false;

    if (
      obj2.type === "vessel" &&
      obj1.posY + obj1.heigth === obj2.posY &&
      (obj1.posX + obj1.width < middleReference || obj1.posX > middleReference)
    )
      return false;
    return true;
  }
  return false;
}

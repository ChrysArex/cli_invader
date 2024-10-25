//Here are defined functions for each options of the starting menu
//Basically these option functions launch the execution of another script that properlly
//define the option capabilities

import { fork } from "node:child_process";

export function play() {
  return new Promise((resolve, rejects) => {
    const forked = fork("player.js");
    forked.on("close", () => {
      console.clear();
      resolve("battle finished");
    });
  });
}

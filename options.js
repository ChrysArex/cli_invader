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

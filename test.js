import { fork } from "node:child_process";

const child = fork("child.js", {
  detached: true,
});
child.unref();
child.send("ping");

child.on("message", (ack) => {
  if (ack === "YCE") {
    console.log("imma getting outta here, peace out man!!!");
    child.send("Hey buddy, here is your Faaaaaaather");
    process.exit();
  }
});

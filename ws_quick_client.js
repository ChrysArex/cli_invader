import WebSocket from "ws";

const id = crypto.randomUUID();
console.log(`my ID: ${id}`);
const player = new WebSocket("ws://127.0.0.1:3000/newGame", {
  headers: { playerid: id },
});
let sessionId = null;
process.stdin.on("data", (data) => {
  player.send(
    JSON.stringify({
      type: "action",
      senderId: id,
      sessionId: sessionId,
      content: data.toString(),
    }),
  );
});

player.on("open", () => console.log("I am connected"));
player.on("message", (message) => {
  let msg = JSON.parse(message);
  if (msg.type === "ssId") sessionId = msg.content;
  console.log(`Message: ${msg}`);
});

process.on("message", (msg) => {
  if (msg === "ping") process.send("YCE");
  setTimeout(() => console.log(`Here is the message ${msg}`), 10000);
});

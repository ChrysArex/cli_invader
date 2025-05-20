import figlet from "figlet";
import { confirm } from "@inquirer/prompts";

const endGame = figlet.textSync("Do you really want to leave the party ?", {
  font: "Graffiti",
  horizontalLayout: "default",
  verticalLayout: "default",
  width: 80,
  whitespaceBreak: true,
});
const answer = await confirm({ message: endGame });
console.log(answer);
if (answer) {
  const d = "test";
  const stats = `You have been killed by: ${d} \nkills: ${d} \nshots: ${d} \ndammages: ${d} \n`;

  console.log(stats);
}

console.log("Press any key to exit");

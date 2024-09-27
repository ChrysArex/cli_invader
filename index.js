#!/usr/bin/env node

import { program } from "commander";
import { fork } from "node:child_process";
import chalk from "chalk";
import { select, Separator } from "@inquirer/prompts";
import figlet from "figlet";

const banner = figlet.textSync("CLI INVADER", {
  font: "Graffiti",
  horizontalLayout: "default",
  verticalLayout: "default",
  width: 80,
  whitespaceBreak: true,
});

async function play() {
  const forked = await fork("player.js");
  forked.on('close', (msg) => {
	  console.clear();
	  console.log('Press UP or Down arrow key to go back to menu');
  });
}

program.version("1.0.0").description("My Node CLI");

program.action(async () => {
  console.clear();
  console.log(chalk.green(banner));

  while (1) {
    const answer = await select({
      message: "Welcome captain",
      choices: [
        {
          name: "Start a new battle",
          value: "newBattle",
          description: "Connect to the server for the battle",
        },
        new Separator(""),
        {
          name: "Notifications",
          value: "notifications",
          description: "See your notifications",
        },
        new Separator(""),
        {
          name: "Settings",
          value: "settings",
          description: "Manage username, starship, appearance and more",
        },
        new Separator(""),
        {
          name: "Stats",
          value: "stats",
          description: "Show a track record of your battles",
        },
        new Separator(""),
        {
          name: "Help",
          value: "help",
          description: "Need some help? You are in the right place",
        },
        new Separator(""),
        {
          name: "Exit",
          value: "exit",
          description: "See you for the next battle",
        },
        new Separator(),
      ],
    });

    switch (answer) {
      case "newBattle":
        console.clear();
        await play();
        break;
      case "notifications":
        console.log("Showing notifications...");
        break;
      case "settings":
        console.log("Opening settings...");
        break;
      case "stats":
        console.log("Displaying stats...");
        break;
      case "help":
        console.log("Showing help...");
        break;
      case "exit":
        process.exit();
        break;
      default:
        console.log("Unknown option selected");
        break;
    }
  }
});

program.parse(process.argv);

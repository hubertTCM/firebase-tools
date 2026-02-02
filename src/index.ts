import yargs from "yargs";

import { buildDeployCommand } from "./deploy";
import { buildEmulatorsCommand } from "./emulator";

function run() {
  const userCommand = process.argv.slice(2).join(" ");
  const argv = yargs(process.argv.slice(2));
  buildDeployCommand(argv);
  buildEmulatorsCommand(argv);
  argv
    .command("example", "example", (yargs) => {
      return yargs
        .option("count", {
          type: "number",
          default: 1,
          description: "Number of characters to generate",
        })
        .option("type", {
          type: "string",
          choices: ["hero", "villain"],
          default: "hero",
          description: "Type of character to generate",
        });
    })
    .demandCommand(1, `You must specify at least one command. ${userCommand}`)
    .help().argv;
}

run();

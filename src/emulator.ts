import { execa } from "execa";
import fs from "fs";
import { glob } from "glob";
import os from "os";
import path from "path";
import { Argv } from "yargs";

// document: https://firebase.google.com/docs/hosting/quickstart

const projectRoot = path.resolve(__dirname, "../", "../", "../");

async function findProcessOnMacOrLinux(port: number): Promise<string> {
  const { stdout } = await execa("lsof", ["-t", "-i", `:${port}`]);
  return stdout.trim();
}

async function findProcessOnWindows(port: number): Promise<string> {
  const command = `netstat -ano | findstr :${port}`;

  const { stdout } = await execa(command, { shell: true });
  const lines = stdout.trim().split("\n");
  const processInfo = lines.find((line) => line.includes(`:${port}`));

  if (processInfo) {
    const parts = processInfo.trim().split(/\s+/);
    return parts[parts.length - 1];
  }
  return "";
}

async function killProcessOnPort(port: number): Promise<void> {
  const platform = os.platform();
  let pid = "";

  try {
    if (platform === "win32") {
      pid = await findProcessOnWindows(port);
      await execa("taskkill", ["/F", "/PID", `${pid}`]);
    } else {
      pid = await findProcessOnMacOrLinux(port);
      await execa("kill", ["-9", `${pid}`]);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `❌ Failed to kill process on port ${port}: ${error.message}`,
      );
    } else {
      console.error(`❌ Failed to kill process on port ${port}`, error);
    }
  }
}

async function findFiles(directory: string): Promise<string[]> {
  const patterns = [`${directory}/*debug*.*`, `${directory}/firebase-export-*`];

  // Use the glob function with the patterns array
  const files = await glob(patterns, {
    ignore: ["**/node_modules/**", "**/dist/**"], // Optional: ignore directories
  });

  return files;
}
async function deleteFiles(files: string[]): Promise<void> {
  const promises = files.map(async (filePath) => {
    try {
      await fs.promises.rm(filePath, { recursive: true, force: true });
      console.log(`✅ Successfully deleted: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to delete ${filePath}`, error);
    }
  });

  await Promise.all(promises);
}

const optionsValue = ["start", "stop"] as const;
type OptionType = (typeof optionsValue)[number];

type EmulatorsArgs = {
  option: OptionType;
};

async function cleanup() {
  const ports: number[] = [8080, 8085, 9000, 9099, 9199, 9090, 4000];
  await Promise.all(ports.map(killProcessOnPort));
  const files = await findFiles(projectRoot);
  await deleteFiles(files);
}

async function start() {
  await cleanup();
  await execa(
    "firebase",
    ["emulators:start", "--import=./emulator-data", "--export-on-exit"],
    {
      stdio: "inherit",
    },
  );
  console.log("started");
}

async function handle(args: EmulatorsArgs) {
  const { option } = args;
  try {
    process.chdir(projectRoot);
    switch (option) {
      case "start": {
        start();
        break;
      }
      case "stop":
        cleanup();
        break;

      default:
        break;
    }
  } catch (error) {
    console.error("Emulators command failed:", error, args);
  }
}

export function buildEmulatorsCommand(argv: Argv) {
  return argv.command<EmulatorsArgs>(
    "emulators",
    "run emulators, eg: yarn tool -- emulators --options start",
    (yargs) => {
      return yargs.option("options", {
        type: "string",
        choices: optionsValue,
        default: "start",
        description: "start or stop emulators",
      });
    },
    handle,
  );
}

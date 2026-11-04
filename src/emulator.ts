import { execa } from "execa";
import fs from "fs";
import { glob } from "glob";
import os from "os";
import path from "path";
import { Argv } from "yargs";

// document: https://firebase.google.com/docs/hosting/quickstart

const projectRoot = path.resolve(__dirname, "../", "../", "../");

// Only listeners: clients connected to the port (e.g. a browser) must survive
async function findProcessesOnMacOrLinux(port: number): Promise<string[]> {
  // lsof exits 1 when nothing matches, which is the normal "port is free" case
  const { stdout } = await execa(
    "lsof",
    ["-t", "-i", `:${port}`, "-sTCP:LISTEN"],
    { reject: false },
  );
  return stdout.split(/\s+/).filter(Boolean);
}

async function findProcessesOnWindows(port: number): Promise<string[]> {
  const { stdout } = await execa(`netstat -ano | findstr :${port}`, {
    shell: true,
    reject: false,
  });
  const pids = stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    // Local address (2nd column) must be exactly this port, e.g. 0.0.0.0:8080
    .filter((parts) => parts[1]?.endsWith(`:${port}`))
    .map((parts) => parts[parts.length - 1]);
  return pids;
}

async function killProcessOnPort(port: number): Promise<void> {
  const isWindows = os.platform() === "win32";
  const pids = [
    ...new Set(
      isWindows
        ? await findProcessesOnWindows(port)
        : await findProcessesOnMacOrLinux(port),
    ),
  ].filter((pid) => pid !== "0" && pid !== String(process.pid));

  // Nothing listening: nothing to do
  for (const pid of pids) {
    try {
      if (isWindows) {
        await execa("taskkill", ["/F", "/PID", pid]);
      } else {
        await execa("kill", ["-9", pid]);
      }
      console.log(`✅ Killed process ${pid} on port ${port}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ Failed to kill process ${pid} on port ${port}: ${message}`,
      );
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

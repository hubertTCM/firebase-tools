import path from "path";
import { execSync } from "child_process";
import { Argv } from "yargs";

// document: https://firebase.google.com/docs/hosting/quickstart

const projectRoot = path.resolve(__dirname, "../", "../", "../");

function getGitVersion() {
  const version = execSync("git rev-parse --short HEAD").toString().trim();
  return version;
}

function build(version: string) {
  console.log("Start build", { workingDir: process.cwd(), version });
  execSync("yarn build", {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_BUILD_VERSION: version,
    },
  });
  console.log("Build completed successfully.");
}

function pushGitTag(tagName: string) {
  // Check if a tag with this name already exists
  try {
    execSync(`git show-ref --tags --verify --quiet refs/tags/${tagName}`);
    console.log(`Tag '${tagName}' already exists. Skipping.`);
    return;
  } catch (error) {
    // Expected: the tag does not exist, so we proceed to create it.
    console.log(`Creating new tag: ${tagName}`);
  }

  execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, {
    stdio: "inherit",
  });
  execSync(`git push origin ${tagName}`, {
    stdio: "inherit",
  });
  console.log(`Pushed git tag ${tagName} to origin.`);
}

const deployOnly: string[] = ["host", "rules", "indexes"] as const;
type DeployOnlyType = (typeof deployOnly)[number];

type DeployArgs = {
  only: DeployOnlyType;
};
function handle(options: DeployArgs) {
  const gitVersion = getGitVersion();
  const buildVersion = `1.0.0-${gitVersion}`;
  try {
    process.chdir(projectRoot);
    const { only } = options;
    switch (only) {
      case "host":
        {
          build(buildVersion);
          pushGitTag(buildVersion);
          console.log("Deploying hosting...");
          execSync(`npx firebase deploy --only hosting`, {
            stdio: "inherit",
          });
        }
        break;
      case "rules":
        console.log("Deploying firestore rules...");
        execSync("npx firebase deploy --only firestore:rules", {
          stdio: "inherit",
        });
        break;
      case "indexes":
        console.log("Deploying firestore indexes...");
        execSync("npx firebase deploy --only firestore:indexes", {
          stdio: "inherit",
        });
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Error deploying:", error, options, { buildVersion });
  }
}

export function buildDeployCommand(argv: Argv) {
  return argv.command<DeployArgs>(
    "deploy",
    "deploy to firebase, eg: yarn tool -- deploy --only host",
    (yargs) => {
      return yargs.option("only", {
        type: "string",
        choices: deployOnly,
        default: "host",
        description: "deploy host only",
      });
    },
    handle,
  );
}

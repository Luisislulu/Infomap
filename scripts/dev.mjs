import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBinary = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);

const children = [
  spawn(process.execPath, [path.join(projectRoot, "scripts", "refresh-server.mjs")], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  }),
  spawn(nextBinary, ["dev"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  }),
];

let shuttingDown = false;
let exitCode = 0;
let closedChildren = 0;
let forceExitTimer;

function stopChildren(signal = "SIGTERM", code = exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;
  children.forEach((child) => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  });
  forceExitTimer = setTimeout(() => process.exit(exitCode), 3_000);
}

children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error);
    stopChildren("SIGTERM", 1);
  });
  child.on("close", (code, signal) => {
    closedChildren += 1;
    if (!shuttingDown) {
      stopChildren("SIGTERM", code ?? (signal ? 1 : 0));
    }
    if (closedChildren === children.length) {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    }
  });
});

process.on("SIGINT", () => stopChildren("SIGINT", 130));
process.on("SIGTERM", () => stopChildren("SIGTERM", 143));

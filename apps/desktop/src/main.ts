import { app, BrowserWindow, dialog } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import {
  loadOrCreateSecrets,
  resolveServerPaths,
  buildServerEnv,
  type ServerPaths,
} from "./bootstrap";

// Set before the app is ready so app.getPath("userData") resolves to a clean,
// branded folder (otherwise it would use the slashed package name).
app.setName("TG to Discord Forwarder");

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let serverPort = 3000;
let quitting = false;

// Pick an available port, preferring 3000 so URLs stay predictable.
function findFreePort(preferred: number): Promise<number> {
  const tryPort = (port: number) =>
    new Promise<number | null>((resolve) => {
      const srv = net.createServer();
      srv.once("error", () => resolve(null));
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port, "127.0.0.1");
    });

  return tryPort(preferred).then((p) => {
    if (p) return p;
    // Ephemeral port: bind to 0, read what the OS assigned.
    return new Promise<number>((resolve, reject) => {
      const srv = net.createServer();
      srv.once("error", reject);
      srv.listen(0, "127.0.0.1", () => {
        const addr = srv.address();
        const port = typeof addr === "object" && addr ? addr.port : preferred;
        srv.close(() => resolve(port));
      });
    });
  });
}

function waitForHealth(port: number, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error("Server did not become healthy in time"));
      setTimeout(poll, 400);
    };
    poll();
  });
}

function startServer(paths: ServerPaths, env: NodeJS.ProcessEnv): ChildProcess {
  const logPath = path.join(app.getPath("userData"), "server.log");
  const logFd = fs.openSync(logPath, "a");
  // ELECTRON_RUN_AS_NODE (set in env) makes the forked child run as plain Node,
  // so it can read the unpacked server bundle and node_modules from disk.
  const child = fork(paths.serverEntry, [], {
    env,
    cwd: app.getPath("userData"),
    stdio: ["ignore", logFd, logFd, "ipc"],
  });
  child.on("exit", (code) => {
    if (quitting) return;
    dialog.showErrorBox(
      "Server stopped",
      `The background server exited unexpectedly (code ${code}).\nSee the log at:\n${logPath}`,
    );
  });
  return child;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    title: "TG to Discord Forwarder",
    backgroundColor: "#15171c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(`http://localhost:${serverPort}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot(): Promise<void> {
  const userDataDir = app.getPath("userData");
  const secrets = loadOrCreateSecrets(userDataDir);
  const paths = resolveServerPaths(__dirname);

  serverPort = await findFreePort(3000);
  const env = buildServerEnv({ userDataDir, port: serverPort, secrets, paths });
  serverProcess = startServer(paths, env);

  try {
    await waitForHealth(serverPort);
  } catch (err) {
    dialog.showErrorBox(
      "Startup failed",
      `Could not start the background server.\n${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
    return;
  }

  await createWindow();

  // Tell the user their auto-generated login on first launch.
  if (secrets.isFirstRun) {
    await dialog.showMessageBox(mainWindow!, {
      type: "info",
      title: "Your dashboard login",
      message: "A dashboard account was created for you.",
      detail:
        `Username: ${secrets.adminUsername}\n` +
        `Password: ${secrets.adminPassword}\n\n` +
        `This is also saved to credentials.txt in the app's data folder.`,
      buttons: ["Got it"],
    });
  }
}

// Single-instance: focus the existing window instead of starting a 2nd server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverProcess) void createWindow();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  // Stop the server cleanly (its SIGTERM handler closes Fastify/Telegram/Prisma).
  app.on("before-quit", () => {
    quitting = true;
    if (serverProcess && !serverProcess.killed) serverProcess.kill("SIGTERM");
  });
}

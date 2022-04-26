import electron, {
  app,
  BrowserWindow,
  shell,
  Menu,
  Tray,
  nativeImage,
  MenuItem,
} from "electron";
import { release } from "os";
import { join } from "path";
import tmi from "tmi.js";
import axios from "axios";
import { config } from "./config";
import Store from "electron-store";
import LightBulbImage from "../images/light-bulb.png";
import ConnectedImage from "../images/connected.png";
import DisconnectedImage from "../images/disconnected.png";
import Logo from "../images/logo.png";
import LogoRed from "../images/logo-red.png";

const LogoImage = nativeImage
  .createFromDataURL(Logo)
  .resize({ width: 16, height: 16 });

const LogoRedImage = nativeImage
  .createFromDataURL(LogoRed)
  .resize({ width: 16, height: 16 });

const ipc = electron.ipcMain;

const store = new Store({
  watch: true,
  schema: {
    channelName: {
      type: "string",
    },
    apiKey: {
      type: "string",
    },
  },
});

let tmiInstance: tmi.Client | undefined;
let connected = false;
let isQuitting = false;

console.log("setting up watchers");
ipc.on("configChanged", async (event, args) => {
  console.log("setting store values", args[0]);
  store.set("channelName", args[0].channelName);
  store.set("apiKey", args[0].apiKey);

  tmiInstance?.disconnect();
  tmiInstance = await connectTmi({
    channelName: store.get("channelName") as string,
    apiKey: store.get("apiKey") as string,
  });

  event.reply("config", [
    { channelName: store.get("channelName"), apiKey: store.get("apiKey") },
  ]);
});
ipc.on("configRequested", (event, args) => {
  console.log("configRequested on server");

  event.reply("config", [
    { channelName: store.get("channelName"), apiKey: store.get("apiKey") },
  ]);
});

store.onDidAnyChange((newConfig, oldConfig) => {
  console.log("CHANGED CONFIG", { newConfig, oldConfig });
});

interface TmiConfig {
  channelName: string;
  apiKey: string;
}

let { baseApiUrl = "localhost:3000/api" } = config.dev;
if (app.isPackaged) {
  baseApiUrl = config.prod.baseApiUrl;
}

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) {
  app.disableHardwareAcceleration();
}

// Set application name for Windows 10+ notifications
if (process.platform === "win32") {
  app.setAppUserModelId(app.getName());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      nodeIntegration: true,
      contextIsolation: false,
    },
    width: 200,
    height: 300,
    // resizable: app.isPackaged ? false : true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
  });

  win.on("close", function (event: any) {
    if (!isQuitting && win) {
      console.log("hiding window");
      event.preventDefault();
      win.hide();
    } else {
      console.log("closing window");
      win = null;
    }

    return false;
  });
  app.on("before-quit", function () {
    console.log("before quit");
    isQuitting = true;
  });

  win.on("minimize", function (event: any) {
    event.preventDefault();
    win?.hide();
  });

  if (app.isPackaged) {
    win.loadFile(join(__dirname, "../renderer/index.html"));
    win.webContents.openDevTools();
  } else {
    // 🚧 Use ['ENV_NAME'] avoid vite:define plugin
    const url = `http://${process.env["VITE_DEV_SERVER_HOST"]}:${process.env["VITE_DEV_SERVER_PORT"]}`;

    win.loadURL(url);
    win.webContents.openDevTools();
  }

  // Test active push message to Renderer-process
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    sendConnectedStatus();
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

let tray: Tray;
app
  .whenReady()
  .then(async () => {
    if (store.get("channelName") && store.get("apiKey")) {
      tmiInstance = await connectTmi({
        channelName: store.get("channelName") as string,
        apiKey: store.get("apiKey") as string,
      });
    }

    if (app.dock) {
      app.dock.hide();
    }

    app.setLoginItemSettings({
      openAsHidden: true,
      openAtLogin: true,
    });

    console.log(
      "store values",
      typeof store.get("channelName"),
      typeof store.get("apiKey")
    );

    tray = new Tray(LogoRedImage);

    buildTrayMenu();
  })
  .then(createWindow)
  .then(() => {
    win?.show();
    if (!store.get("channelName") || !store.get("apiKey")) {
      win?.show();
    }
  });

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

async function connectTmi({ channelName, apiKey }: TmiConfig) {
  console.log("connecting to TMI");

  const apiAxios = axios.create({
    baseURL: baseApiUrl,
    headers: {
      Authorization: `ApiKey ${apiKey}`,
    },
    timeout: 5000,
  });

  console.log("axios created");

  const validApiKey = await apiAxios
    .post("/post-validate-api-key")
    .then(() => {
      console.log("key is valid");
      return true;
    })
    .catch((e: any) => {
      console.log("key is NOT valid", e);
      return false;
    });

  if (!validApiKey) {
    connected = false;
    setTrayImage();
    sendConnectedStatus();
    buildTrayMenu();
    return;
  }

  const client = new tmi.Client({
    options: { debug: true, messagesLogLevel: "info" },
    connection: {
      reconnect: true,
      secure: true,
    },
    channels: [channelName],
  });
  client
    .connect()
    .then(() => {
      connected = true;
      setTrayImage();
      sendConnectedStatus();
      buildTrayMenu();
    })
    .catch((error) => {
      console.error(error);
      connected = false;
      setTrayImage();
      sendConnectedStatus();
      buildTrayMenu();
    });

  client.on("hosting", async (channel, target, viewers) => {
    console.log("HOSTING", channel, target, viewers);
    const postResult = apiAxios
      .post("/post-raids", {
        toTwitchChannel: target,
        fromTwitchChannel: channelName,
        raidAmount: 42,
      })
      .catch(() => {
        connected = false;
        setTrayImage();
        sendConnectedStatus();
        buildTrayMenu();
      });
  });

  client.on("raided", async (channel, target, viewers) => {
    console.log("RAIDED", channel, target, viewers);
    const postResult = await apiAxios
      .post("/post-raids", {
        toTwitchChannel: channelName,
        fromTwitchChannel: target,
        raidAmount: 42,
      })
      .catch(() => {
        connected = false;
        setTrayImage();
        sendConnectedStatus();
        buildTrayMenu();
      });
  });

  return client;
}

function buildTrayMenu() {
  const statusMenuItem = {
    label: "Connected",
    type: "normal",
    enabled: false,
    icon: nativeImage
      .createFromDataURL(ConnectedImage)
      .resize({ height: 16, width: 16 }),
  } as MenuItem;

  if (!connected) {
    statusMenuItem.label = "Not Connected";
    statusMenuItem.icon = nativeImage
      .createFromDataURL(DisconnectedImage)
      .resize({ height: 16, width: 16 });
  }

  const contextMenu = Menu.buildFromTemplate([
    statusMenuItem,
    {
      label: "Configuration",
      type: "normal",
      click: (menuItem, browserWindow, event) => {
        win?.show();
      },
    },
    {
      label: "Quit",
      type: "normal",
      click: (menuItem, browserWindow, event) => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  if (tray) {
    tray.setToolTip("Raidy or Not Bot");
    tray.setContextMenu(contextMenu);
  }
}

function sendConnectedStatus() {
  win?.webContents.send("connectionStatus", [{ connected }]);
}

function setTrayImage() {
  const image = !!connected ? LogoImage : LogoRedImage;
  tray?.setImage(image);
}

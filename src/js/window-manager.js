const { BrowserWindow } = require('electron');


class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.formatterEnabled = true;
  }

  /** Create the overlay BrowserWindow and apply all Electron tweaks. */
  create() {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 800,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      show: true,
      fullscreenable: false,
      backgroundColor: '#00000000',
      focusable: false,
      skipTaskbar: true,
      type: 'panel',
      paintWhenInitiallyHidden: true,
      titleBarStyle: 'hidden',
      enableLargerThanScreen: true,
      movable: true,
    });

    this.mainWindow.setContentProtection(true);
    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

    if (process.platform === 'darwin') {
      this.mainWindow.setHiddenInMissionControl(true);
      this.mainWindow.setWindowButtonVisibility(false);
      this.mainWindow.setBackgroundColor('#00000000');
      this.mainWindow.setSkipTaskbar(true);
      this.mainWindow.setHasShadow(false);
    }

    this.mainWindow.webContents.setBackgroundThrottling(false);
    this.mainWindow.webContents.setFrameRate(60);
    this.mainWindow.loadFile('index.html');
  }

  /** Safe wrapper for renderer calls. */
  send(channel, payload) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  /** Quickly flip the code‑formatter overlay on/off and notify the UI. */
  toggleFormatter() {
    this.formatterEnabled = !this.formatterEnabled;
    this.send('formatter-toggled', this.formatterEnabled);
  }
}

module.exports = WindowManager;
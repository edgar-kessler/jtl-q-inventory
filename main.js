const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const ipcMain = require('electron').ipcMain;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('index.html');
  // Uncomment the following line to open DevTools automatically
  // win.webContents.openDevTools();
}

// IPC Handler für Save Dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(window, options);
  return result;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

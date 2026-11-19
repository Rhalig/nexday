import { app, ipcMain, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initStorage } from './storage'
import { initCalendar } from './calendar'
import { initSecure } from './secure'
import { initFiles } from './files'

const PROTOCOL = 'nexday'
// A sign-in link (nexday://auth/callback?code=...) can arrive before the window exists; keep it until it does.
let pendingLink: string | null = null
let mainWindowRef: BrowserWindow | null = null

function deliverLink(url: string): void {
  if (!url.startsWith(`${PROTOCOL}://`)) return
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    if (mainWindowRef.isMinimized()) mainWindowRef.restore()
    mainWindowRef.focus()
    mainWindowRef.webContents.send('auth:callback', url)
  } else pendingLink = url
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#F5F5F4',
    title: 'Nexday',
    titleBarStyle: 'hiddenInset',
    // Design: 12px dots at x:20, vertically centred in the 24px row above the logo (window y 22–46)
    trafficLightPosition: { x: 20, y: 28 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindowRef = mainWindow
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingLink) {
      mainWindow.webContents.send('auth:callback', pendingLink)
      pendingLink = null
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      if (new URL(details.url).protocol === 'https:') shell.openExternal(details.url)
    } catch {
      /* malformed URL: ignore */
    }
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// One running copy only: a second launch (for instance from a sign-in link) hands its link to the first.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const link = argv.find((a) => a.startsWith(`${PROTOCOL}://`))
    if (link) deliverLink(link)
    else if (mainWindowRef) mainWindowRef.focus()
  })
}
app.on('open-url', (e, url) => {
  e.preventDefault()
  deliverLink(url)
})
if (process.defaultApp && process.argv.length >= 2) {
  // Development: register this Electron + script path as the handler
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.nexday.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // In development the Dock shows Electron's icon unless it is set here.
  if (process.platform === 'darwin' && is.dev) app.dock?.setIcon(icon)
  initStorage()
  initSecure()
  ipcMain.handle('open-external', (_e, url: string) => {
    // Only web pages, never file: or custom schemes
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
  })
  initCalendar()
  initFiles()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

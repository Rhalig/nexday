import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename } from 'path'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/** Save / open dialogs for export and import. The renderer never sees a path it did not pick. */
export function initFiles(): void {
  ipcMain.handle(
    'file:save',
    async (e, name: string, text: string): Promise<{ path: string } | null> => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const opts = { defaultPath: basename(String(name)) }
      const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (r.canceled || !r.filePath) return null
      await writeFile(r.filePath, String(text), 'utf8')
      return { path: r.filePath }
    }
  )

  ipcMain.handle(
    'file:open',
    async (e): Promise<{ name: string; text: string } | { error: string } | null> => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const opts = {
        properties: ['openFile' as const],
        filters: [{ name: 'Tasks', extensions: ['json', 'csv'] }]
      }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (r.canceled || !r.filePaths[0]) return null
      const path = r.filePaths[0]
      if ((await stat(path)).size > MAX_IMPORT_BYTES) return { error: 'tooBig' }
      return { name: basename(path), text: await readFile(path, 'utf8') }
    }
  )
}

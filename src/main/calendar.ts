import { app, ipcMain } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Apple Calendar through EventKit. A small signed helper (native/eventkit) does the reading and
 * prints JSON; this file only runs it and passes the answer to the window.
 */
function helperPath(): string {
  const packaged = join(process.resourcesPath, 'bin', 'nexday-eventkit')
  if (app.isPackaged && existsSync(packaged)) return packaged
  return join(app.getAppPath(), 'resources', 'bin', 'nexday-eventkit')
}

function run(args: string[], timeout = 15000): Promise<unknown> {
  return new Promise((resolve) => {
    if (process.platform !== 'darwin' || !existsSync(helperPath())) {
      resolve({ error: 'unavailable' })
      return
    }
    execFile(helperPath(), args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      try {
        resolve(JSON.parse(stdout))
      } catch {
        resolve({ error: err ? 'failed' : 'empty' })
      }
    })
  })
}

export function initCalendar(): void {
  ipcMain.handle('cal:status', () => run(['status']))
  // The permission sheet can wait on the person, so this call gets a long timeout.
  ipcMain.handle('cal:request', () => run(['request'], 75000))
  ipcMain.handle('cal:calendars', () => run(['calendars']))
  ipcMain.handle('cal:events', (_e, startMs: number, endMs: number) => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return { error: 'range' }
    return run(['events', String(Math.floor(startMs / 1000)), String(Math.floor(endMs / 1000))])
  })
  ipcMain.handle('cal:create', (_e, payload: unknown) => {
    if (!payload || typeof payload !== 'object') return { error: 'payload' }
    const p = payload as { title?: unknown; startMs?: unknown; endMs?: unknown }
    if (typeof p.title !== 'string' || !Number.isFinite(p.startMs) || !Number.isFinite(p.endMs)) {
      return { error: 'payload' }
    }
    return run(['create', JSON.stringify(payload)], 20000)
  })
  ipcMain.handle('cal:delete', (_e, id: string) =>
    typeof id === 'string' && id ? run(['delete', id]) : { error: 'id' }
  )
}

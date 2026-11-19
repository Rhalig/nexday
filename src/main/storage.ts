import { app, ipcMain } from 'electron'
import { existsSync, readFileSync, renameSync } from 'fs'
import { mkdir, rename, writeFile } from 'fs/promises'
import { join, dirname } from 'path'

/**
 * One JSON document in the user's data folder. Slices are saved by key and the file is
 * written atomically (temp file + rename), so a crash mid-write never leaves half a file.
 */
type Doc = { version: 1; data: Record<string, unknown> }

let doc: Doc = { version: 1, data: {} }
let file = ''
let timer: NodeJS.Timeout | null = null
let writing: Promise<void> = Promise.resolve()

function load(): void {
  file = join(app.getPath('userData'), 'nexday-data.json')
  if (!existsSync(file)) return
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Doc
    if (parsed && parsed.version === 1 && typeof parsed.data === 'object') doc = parsed
  } catch {
    // Unreadable file: keep it as a backup instead of overwriting it, then start fresh.
    try {
      renameSync(file, `${file}.corrupt-${Date.now()}`)
    } catch {
      /* nothing more we can do */
    }
  }
}

function flush(): Promise<void> {
  writing = writing.then(async () => {
    const tmp = `${file}.tmp`
    await mkdir(dirname(file), { recursive: true })
    await writeFile(tmp, JSON.stringify(doc), 'utf8')
    await rename(tmp, file)
  })
  return writing
}

export function initStorage(): void {
  load()
  ipcMain.handle('store:load', () => doc.data)
  ipcMain.handle('store:save', (_e, key: string, value: unknown) => {
    if (typeof key !== 'string') return
    doc.data[key] = value
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), 250)
  })
  ipcMain.handle('store:clear', async () => {
    doc = { version: 1, data: {} }
    await flush()
  })
  app.on('before-quit', () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      void flush()
    }
  })
}

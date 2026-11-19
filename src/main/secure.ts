import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { mkdir, rename, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

/**
 * Small encrypted key/value store for secrets (the login session). Values are encrypted with the
 * macOS Keychain through Electron's safeStorage, so the file on disk is useless without the user's login.
 */
let file = ''
let data: Record<string, string> = {}

function load(): void {
  file = join(app.getPath('userData'), 'nexday-secure.json')
  if (!existsSync(file)) return
  try {
    data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
  } catch {
    data = {}
  }
}

async function flush(): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(`${file}.tmp`, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 })
  await rename(`${file}.tmp`, file)
}

export function initSecure(): void {
  load()
  ipcMain.handle('secure:get', (_e, key: string) => {
    const raw = data[key]
    if (!raw || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(raw, 'base64'))
    } catch {
      return null
    }
  })
  ipcMain.handle('secure:set', async (_e, key: string, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) return
    data[key] = safeStorage.encryptString(value).toString('base64')
    await flush()
  })
  ipcMain.handle('secure:remove', async (_e, key: string) => {
    delete data[key]
    await flush()
  })
}

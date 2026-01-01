import { StorageData, Session, Preset, DEFAULT_PRESETS } from './types'

const STORAGE_KEY = 'setflow'

const defaultData: StorageData = {
  activeSession: null,
  presets: DEFAULT_PRESETS,
  overlayMinimized: false,
  overlayPosition: null,
}

export async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = (result[STORAGE_KEY] || {}) as Partial<StorageData>
  return { ...defaultData, ...stored }
}

export async function setStorageData(data: Partial<StorageData>): Promise<void> {
  const current = await getStorageData()
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...current, ...data },
  })
}

export async function getActiveSession(): Promise<Session | null> {
  const data = await getStorageData()
  return data.activeSession
}

export async function setActiveSession(session: Session | null): Promise<void> {
  await setStorageData({ activeSession: session })
}

export async function getPresets(): Promise<Preset[]> {
  const data = await getStorageData()
  return data.presets
}

export async function savePreset(preset: Preset): Promise<void> {
  const data = await getStorageData()
  const existingIndex = data.presets.findIndex((p) => p.name === preset.name)

  if (existingIndex >= 0) {
    data.presets[existingIndex] = preset
  } else {
    data.presets.push(preset)
  }

  await setStorageData({ presets: data.presets })
}

export async function deletePreset(name: string): Promise<void> {
  const data = await getStorageData()
  await setStorageData({
    presets: data.presets.filter((p) => p.name !== name),
  })
}

export async function getOverlayState(): Promise<{
  minimized: boolean
  position: { x: number; y: number } | null
}> {
  const data = await getStorageData()
  return {
    minimized: data.overlayMinimized,
    position: data.overlayPosition,
  }
}

export async function setOverlayState(state: {
  minimized?: boolean
  position?: { x: number; y: number } | null
}): Promise<void> {
  const updates: Partial<StorageData> = {}
  if (state.minimized !== undefined) {
    updates.overlayMinimized = state.minimized
  }
  if (state.position !== undefined) {
    updates.overlayPosition = state.position
  }
  await setStorageData(updates)
}

export function onStorageChange(
  callback: (data: StorageData) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      callback(changes[STORAGE_KEY].newValue as StorageData)
    }
  }

  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

export type CameraPace = 'smooth' | 'snappy';

const CAMERA_PACE_STORAGE_KEY = 'agent-town.camera.pace';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadCameraPace(storage: StorageLike | null): CameraPace {
  const raw = storage?.getItem(CAMERA_PACE_STORAGE_KEY);
  return raw === 'snappy' ? 'snappy' : 'smooth';
}

export function storeCameraPace(pace: CameraPace, storage: StorageLike | null): void {
  storage?.setItem(CAMERA_PACE_STORAGE_KEY, pace);
}

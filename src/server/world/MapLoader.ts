import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TiledMapData } from './NavGrid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadTownMap(mapPath?: string): TiledMapData {
  const resolvedPath = mapPath ?? path.resolve(__dirname, '../../../public/assets/tiles/town.json');
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  return JSON.parse(raw) as TiledMapData;
}

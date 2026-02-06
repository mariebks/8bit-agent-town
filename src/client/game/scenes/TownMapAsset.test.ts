import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AStar } from '../pathfinding/AStar';

interface TiledLayer {
  name: string;
  data: number[];
  width: number;
  height: number;
  visible: boolean;
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: Array<{
    firstgid: number;
    name: string;
    tilecount: number;
    tilewidth: number;
    tileheight: number;
    image: string;
  }>;
}

const mapPath = join(process.cwd(), 'public', 'assets', 'tiles', 'town.json');
const tilesetPath = join(process.cwd(), 'public', 'assets', 'tiles', 'tileset.png');

function readMap(): TiledMap {
  const raw = readFileSync(mapPath, 'utf8');
  return JSON.parse(raw) as TiledMap;
}

describe('Phase 1 map assets', () => {
  it('defines a valid 40x30 map with 16x16 tiles', () => {
    const map = readMap();

    expect(map.width).toBe(40);
    expect(map.height).toBe(30);
    expect(map.tilewidth).toBe(16);
    expect(map.tileheight).toBe(16);
  });

  it('contains required layers with full tile coverage', () => {
    const map = readMap();

    const layerNames = map.layers.map((layer) => layer.name);
    expect(layerNames).toEqual(expect.arrayContaining(['ground', 'objects', 'above', 'collision']));

    const expectedSize = map.width * map.height;
    for (const name of ['ground', 'objects', 'above', 'collision']) {
      const layer = map.layers.find((item) => item.name === name);
      expect(layer).toBeDefined();
      expect(layer?.width).toBe(map.width);
      expect(layer?.height).toBe(map.height);
      expect(layer?.data).toHaveLength(expectedSize);
    }
  });

  it('marks collision map boundaries as blocked', () => {
    const map = readMap();
    const collision = map.layers.find((layer) => layer.name === 'collision');
    expect(collision).toBeDefined();

    const width = map.width;
    const height = map.height;
    const data = collision!.data;

    for (let x = 0; x < width; x += 1) {
      expect(data[x]).toBeGreaterThan(0);
      expect(data[(height - 1) * width + x]).toBeGreaterThan(0);
    }

    for (let y = 0; y < height; y += 1) {
      expect(data[y * width]).toBeGreaterThan(0);
      expect(data[y * width + (width - 1)]).toBeGreaterThan(0);
    }
  });

  it('declares the expected tileset metadata', () => {
    const map = readMap();
    expect(map.tilesets).toHaveLength(1);

    const tileset = map.tilesets[0];
    expect(tileset.name).toBe('town_tiles');
    expect(tileset.firstgid).toBe(1);
    expect(tileset.tilecount).toBe(2);
    expect(tileset.tilewidth).toBe(16);
    expect(tileset.tileheight).toBe(16);
    expect(tileset.image).toBe('tileset.png');
  });

  it('ships a PNG tileset file', () => {
    const bytes = readFileSync(tilesetPath);
    expect(bytes.length).toBeGreaterThan(8);

    const pngSignature = '89504e470d0a1a0a';
    expect(bytes.subarray(0, 8).toString('hex')).toBe(pngSignature);
  });

  it('keeps debug spawn points mutually reachable on collision grid', () => {
    const map = readMap();
    const collision = map.layers.find((layer) => layer.name === 'collision');
    expect(collision).toBeDefined();

    const walkable: boolean[][] = [];
    for (let y = 0; y < map.height; y += 1) {
      walkable[y] = [];
      for (let x = 0; x < map.width; x += 1) {
        walkable[y][x] = collision!.data[y * map.width + x] <= 0;
      }
    }

    const astar = new AStar(walkable);
    const spawns = [
      { tileX: 4, tileY: 4 },
      { tileX: 8, tileY: 18 },
      { tileX: 19, tileY: 10 },
      { tileX: 30, tileY: 7 },
      { tileX: 35, tileY: 24 },
    ];

    for (let i = 1; i < spawns.length; i += 1) {
      const path = astar.findPath(spawns[0], spawns[i]);
      expect(path).not.toBeNull();
      expect(path?.length).toBeGreaterThan(0);
    }
  });
});

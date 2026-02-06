export type AgentId = string;
export type LocationId = string;

export interface Position {
  x: number;
  y: number;
}

export interface TilePosition {
  tileX: number;
  tileY: number;
}

export enum AgentState {
  Idle = 'idle',
  Walking = 'walking',
  Conversing = 'conversing',
  Activity = 'activity',
  Sleeping = 'sleeping'
}

export interface AgentData {
  id: AgentId;
  name: string;
  position: Position;
  tilePosition: TilePosition;
  state: AgentState;
  color: number;
  path?: TilePosition[];
}

export interface LocationData {
  id: LocationId;
  name: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  tags: string[];
}

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
  totalMinutes: number;
}

export const TILE_SIZE = 16;
export const MAP_WIDTH_TILES = 40;
export const MAP_HEIGHT_TILES = 30;

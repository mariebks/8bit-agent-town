import { AgentData, AgentId, AgentState, LocationId, Position, TilePosition } from '@shared/Types';

export interface OccupationData {
  id: string;
  workplace: LocationId | null;
  schedule: {
    start: number;
    end: number;
  } | null;
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  age: number;
  occupation: OccupationData;
  traits: string[];
  interests: string[];
  bio: string;
  homeLocation: LocationId;
  color: number;
}

export interface AgentStatusMeters {
  energy: number;
  hunger: number;
  mood: number;
  social: number;
}

export interface AgentFullState extends AgentProfile {
  state: AgentState;
  position: Position;
  tilePosition: TilePosition;
  path: TilePosition[];
  currentAction: string;
  nextDecisionTick: number;
  status: AgentStatusMeters;
}

export interface AgentSerializableState extends AgentData {
  profile: Pick<AgentProfile, 'occupation' | 'traits' | 'interests' | 'bio' | 'homeLocation'>;
}

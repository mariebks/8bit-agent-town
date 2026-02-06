import { LocationId } from '@shared/Types';

export enum MemoryType {
  Observation = 'observation',
  Reflection = 'reflection',
  Plan = 'plan',
}

export enum MemorySource {
  Perception = 'perception',
  Dialogue = 'dialogue',
  Internal = 'internal',
  Social = 'social',
}

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  timestamp: number;
  location: LocationId;
  subjects: string[];
  keywords: string[];
  importance: number;
  accessCount: number;
  lastAccessed: number;
  source: MemorySource;
  sourceId?: string;
  parentId?: string;
  isArchived: boolean;
  confidence?: number;
  hopCount?: number;
}

export interface PlanItem {
  id: string;
  description: string;
  targetLocation?: LocationId;
  targetTime?: number;
  priority: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
}

export interface PlanMemory extends Memory {
  type: MemoryType.Plan;
  planItems: PlanItem[];
  validUntil: number;
}

export interface ScoredMemory {
  memory: Memory;
  score: number;
  components: {
    recency: number;
    importance: number;
    relevance: number;
  };
}

export interface MemoryConfig {
  maxObservations: number;
  maxReflections: number;
  maxPlans: number;
  importanceThreshold: number;
}

export interface ObservationInput {
  content: string;
  gameTime: number;
  location: LocationId;
  subjects: string[];
  source: MemorySource;
  sourceId?: string;
  confidence?: number;
  hopCount?: number;
  importance?: number;
}

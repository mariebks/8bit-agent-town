import { AgentId, LocationData, LocationId, TilePosition } from '@shared/Types';

export interface SpawnConfiguration {
  agentHomes: Map<AgentId, LocationId>;
  locationSpawns: Map<LocationId, TilePosition[]>;
}

export function buildSpawnConfiguration(agentIds: AgentId[], locations: LocationData[]): SpawnConfiguration {
  const homes = locations.filter((location) => location.type === 'residential');
  const agentHomes = new Map<AgentId, LocationId>();
  const locationSpawns = new Map<LocationId, TilePosition[]>();

  for (const location of locations) {
    if (location.spawnPoint) {
      locationSpawns.set(location.id, [location.spawnPoint]);
    }
  }

  for (let i = 0; i < agentIds.length; i += 1) {
    const home = homes[i % homes.length];
    agentHomes.set(agentIds[i], home?.id ?? locations[0]?.id ?? 'home_1');
  }

  return {
    agentHomes,
    locationSpawns,
  };
}

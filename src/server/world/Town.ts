import { GameTime, LocationData, LocationId, TilePosition } from '@shared/Types';

const DEFAULT_LOCATIONS: LocationData[] = [
  { id: 'home_1', name: 'Home 1', type: 'residential', bounds: { x: 1, y: 1, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 3, tileY: 3 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_2', name: 'Home 2', type: 'residential', bounds: { x: 8, y: 1, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 10, tileY: 3 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_3', name: 'Home 3', type: 'residential', bounds: { x: 15, y: 1, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 17, tileY: 3 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_4', name: 'Home 4', type: 'residential', bounds: { x: 22, y: 1, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 24, tileY: 3 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_5', name: 'Home 5', type: 'residential', bounds: { x: 29, y: 1, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 31, tileY: 3 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_6', name: 'Home 6', type: 'residential', bounds: { x: 1, y: 23, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 3, tileY: 25 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_7', name: 'Home 7', type: 'residential', bounds: { x: 8, y: 23, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 10, tileY: 25 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'home_8', name: 'Home 8', type: 'residential', bounds: { x: 15, y: 23, width: 6, height: 5 }, tags: ['indoor', 'private'], capacity: 2, spawnPoint: { tileX: 17, tileY: 25 }, allowedActivities: ['sleep', 'rest'] },
  { id: 'cafe', name: 'Central Cafe', type: 'commercial', bounds: { x: 22, y: 8, width: 5, height: 4 }, tags: ['indoor', 'social', 'food'], capacity: 8, spawnPoint: { tileX: 24, tileY: 9 }, allowedActivities: ['eat', 'talk'] },
  { id: 'library', name: 'Library', type: 'public', bounds: { x: 29, y: 8, width: 5, height: 4 }, tags: ['indoor', 'quiet'], capacity: 10, spawnPoint: { tileX: 31, tileY: 9 }, allowedActivities: ['read', 'study'] },
  { id: 'park', name: 'Town Park', type: 'outdoor', bounds: { x: 22, y: 13, width: 12, height: 7 }, tags: ['outdoor', 'social'], capacity: 20, spawnPoint: { tileX: 27, tileY: 16 }, allowedActivities: ['walk', 'relax'] },
  { id: 'market', name: 'Market', type: 'commercial', bounds: { x: 1, y: 8, width: 7, height: 5 }, tags: ['food', 'social'], capacity: 12, spawnPoint: { tileX: 4, tileY: 10 }, allowedActivities: ['shop', 'eat'] },
  { id: 'town_hall', name: 'Town Hall', type: 'government', bounds: { x: 9, y: 8, width: 6, height: 5 }, tags: ['indoor', 'formal'], capacity: 10, spawnPoint: { tileX: 11, tileY: 10 }, allowedActivities: ['work', 'meet'] },
  { id: 'clinic', name: 'Clinic', type: 'medical', bounds: { x: 16, y: 8, width: 5, height: 5 }, tags: ['indoor', 'quiet'], capacity: 6, spawnPoint: { tileX: 18, tileY: 10 }, allowedActivities: ['rest', 'visit'] },
  { id: 'school', name: 'School', type: 'education', bounds: { x: 9, y: 14, width: 10, height: 6 }, tags: ['learning'], capacity: 20, spawnPoint: { tileX: 13, tileY: 16 }, allowedActivities: ['learn', 'teach'] },
  { id: 'plaza', name: 'Central Plaza', type: 'outdoor', bounds: { x: 20, y: 20, width: 12, height: 8 }, tags: ['outdoor', 'social'], capacity: 25, spawnPoint: { tileX: 25, tileY: 23 }, allowedActivities: ['socialize', 'wait'] },
];

export class Town {
  private readonly locations = new Map<LocationId, LocationData>();
  private readonly locationOccupancy = new Map<LocationId, number>();

  constructor(locations: LocationData[] = DEFAULT_LOCATIONS) {
    for (const location of locations) {
      this.locations.set(location.id, location);
      this.locationOccupancy.set(location.id, 0);
    }
  }

  getAllLocations(): LocationData[] {
    return [...this.locations.values()];
  }

  getLocation(id: LocationId): LocationData | undefined {
    return this.locations.get(id);
  }

  getLocationsByType(type: string): LocationData[] {
    return this.getAllLocations().filter((location) => location.type === type);
  }

  getLocationsByTag(tag: string): LocationData[] {
    return this.getAllLocations().filter((location) => location.tags.includes(tag));
  }

  getLocationAtPosition(position: TilePosition): LocationData | undefined {
    return this.getAllLocations().find((location) => {
      return (
        position.tileX >= location.bounds.x &&
        position.tileY >= location.bounds.y &&
        position.tileX < location.bounds.x + location.bounds.width &&
        position.tileY < location.bounds.y + location.bounds.height
      );
    });
  }

  getLocationCapacity(id: LocationId): { current: number; max: number } {
    const location = this.locations.get(id);
    if (!location) {
      return { current: 0, max: 0 };
    }

    return {
      current: this.locationOccupancy.get(id) ?? 0,
      max: location.capacity ?? Number.POSITIVE_INFINITY,
    };
  }

  setOccupancy(id: LocationId, current: number): void {
    this.locationOccupancy.set(id, Math.max(0, current));
  }

  isLocationOpen(_id: LocationId, _gameTime: GameTime): boolean {
    return true;
  }
}

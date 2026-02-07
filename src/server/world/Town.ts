import { GameTime, LocationData, LocationId, TilePosition } from '@shared/Types';
import { DEFAULT_TOWN_LOCATIONS } from '@shared/TownLocations';

export class Town {
  private readonly locations = new Map<LocationId, LocationData>();
  private readonly locationOccupancy = new Map<LocationId, number>();

  constructor(locations: LocationData[] = DEFAULT_TOWN_LOCATIONS) {
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

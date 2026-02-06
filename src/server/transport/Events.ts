import { DeltaEvent, SnapshotEvent } from '@shared/Events';

export function serializeServerEvent(event: SnapshotEvent | DeltaEvent): string {
  return JSON.stringify(event);
}

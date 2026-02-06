import { MemoryStream } from './MemoryStream';

export class Pruner {
  compact(stream: MemoryStream, currentGameTime: number): void {
    stream.prune(currentGameTime);
  }
}

import { MemoryStream } from './MemoryStream';
import { ScoredMemory } from './Types';

export interface RetrievalRequest {
  query: string;
  currentGameTime: number;
  limit?: number;
  contextTerms?: string[];
}

export class Retriever {
  retrieve(stream: MemoryStream, request: RetrievalRequest): ScoredMemory[] {
    return stream.retrieveTopK(request.query, request.currentGameTime, request.limit ?? 8, request.contextTerms ?? []);
  }
}

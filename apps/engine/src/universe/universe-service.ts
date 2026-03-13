/**
 * Обновление universe (список символов). MVP: статический список или из Firestore.
 */

export interface UniverseService {
  refresh(): Promise<string[]>;
}

export class StaticUniverseService implements UniverseService {
  constructor(private readonly symbols: string[]) {}
  refresh(): Promise<string[]> {
    return Promise.resolve([...this.symbols]);
  }
}

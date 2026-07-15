// lib/intelligence/search/registry.ts
// Search Registry — Modules register their search providers

export interface SearchProvider {
  name: string;
  search: (entityId: string, query: string) => Promise<any[]>;
  type: string;
}

class SearchRegistry {
  private providers: SearchProvider[] = [];

  register(provider: SearchProvider): void {
    this.providers.push(provider);
    console.log(`🔍 Search provider registered: ${provider.name}`);
  }

  getProviders(): SearchProvider[] {
    return this.providers;
  }

  async searchAll(entityId: string, query: string): Promise<any[]> {
    const results: any[] = [];
    for (const provider of this.providers) {
      try {
        const result = await provider.search(entityId, query);
        results.push(...result);
      } catch (error) {
        console.error(`Search provider ${provider.name} failed:`, error);
      }
    }
    return results;
  }
}

export const searchRegistry = new SearchRegistry();

// Register property search
import { searchProperty } from './property';
searchRegistry.register({
  name: 'property',
  search: searchProperty,
  type: 'property',
});

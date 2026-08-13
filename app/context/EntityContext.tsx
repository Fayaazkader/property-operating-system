"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface EntityContextType {
  availableEntities: Array<{ entity_id: string; entity_name: string }>;
  activeEntityId: string | null;
  activeScope: 'all' | 'entity';
  setActiveEntityId: (id: string | null) => void;
  loading: boolean;
  hasAccess: boolean;
}

const EntityContext = createContext<EntityContextType | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [availableEntities, setAvailableEntities] = useState<Array<{ entity_id: string; entity_name: string }>>([]);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function loadEntities() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data: accessRows } = await supabase
          .from('user_entity_access')
          .select('entity_id, entities:entity_id(entity_name)')
          .eq('user_id', session.user.id);

        if (!accessRows?.length) { setLoading(false); return; }

        setHasAccess(true);

        const entities = accessRows.map((row: any) => ({
          entity_id: row.entity_id,
          entity_name: row.entities?.entity_name || row.entity_id.substring(0, 8),
        }));

        setAvailableEntities(entities);

        // Check persisted entity — validate against actual access
        const saved = typeof window !== 'undefined'
          ? localStorage.getItem('assetflow_active_entity')
          : null;

        if (saved && entities.some(e => e.entity_id === saved)) {
          setActiveEntityId(saved);
        } else {
          // Default: portfolio-wide
          setActiveEntityId(null);
          if (saved) localStorage.removeItem('assetflow_active_entity');
        }
      } catch (err) {
        console.error('Entity context error:', err);
      }
      setLoading(false);
    }
    loadEntities();
  }, []);

  function handleSetEntityId(id: string | null) {
    setActiveEntityId(id);
    if (id) {
      localStorage.setItem('assetflow_active_entity', id);
    } else {
      localStorage.removeItem('assetflow_active_entity');
    }
  }

  const activeScope: 'all' | 'entity' = activeEntityId ? 'entity' : 'all';

  return (
    <EntityContext.Provider value={{
      availableEntities,
      activeEntityId,
      activeScope,
      setActiveEntityId: handleSetEntityId,
      loading,
      hasAccess,
    }}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntityContext() {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error('useEntityContext must be used within EntityProvider');
  return ctx;
}

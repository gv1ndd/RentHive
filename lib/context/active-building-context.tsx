'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Building } from '@/types/domain';
import { createClient } from '@/lib/supabase/client';

interface ActiveBuildingContextType {
  buildings: Building[];
  activeBuilding: Building | null;
  activeBuildingId: string | null;
  setActiveBuildingId: (id: string | null) => void;
  isLoading: boolean;
  refreshBuildings: () => Promise<void>;
}

const ActiveBuildingContext = createContext<ActiveBuildingContextType | undefined>(undefined);

export function ActiveBuildingProvider({ children }: { children: React.ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeBuildingId, setActiveBuildingIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchBuildings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching buildings:', error);
        return;
      }

      const list = (data || []) as Building[];
      setBuildings(list);

      const savedId = localStorage.getItem('renthive_active_building_id');
      if (savedId && list.some((b) => b.id === savedId)) {
        setActiveBuildingIdState(savedId);
      } else if (list.length > 0) {
        setActiveBuildingIdState(list[0].id);
        localStorage.setItem('renthive_active_building_id', list[0].id);
      } else {
        setActiveBuildingIdState(null);
      }
    } catch (e) {
      console.error('Failed to load buildings:', e);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  const setActiveBuildingId = (id: string | null) => {
    setActiveBuildingIdState(id);
    if (id) {
      localStorage.setItem('renthive_active_building_id', id);
    } else {
      localStorage.removeItem('renthive_active_building_id');
    }
  };

  const activeBuilding = buildings.find((b) => b.id === activeBuildingId) || buildings[0] || null;

  return (
    <ActiveBuildingContext.Provider
      value={{
        buildings,
        activeBuilding,
        activeBuildingId,
        setActiveBuildingId,
        isLoading,
        refreshBuildings: fetchBuildings,
      }}
    >
      {children}
    </ActiveBuildingContext.Provider>
  );
}

export function useActiveBuilding() {
  const context = useContext(ActiveBuildingContext);
  if (!context) {
    throw new Error('useActiveBuilding must be used within an ActiveBuildingProvider');
  }
  return context;
}

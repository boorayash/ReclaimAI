import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getCurrentSimDay, advanceSimClock } from './api';

interface SimClockState {
  currentDay: number;
  refreshTrigger: number;
  advance: (days: number) => Promise<{
    fromDay: number;
    toDay: number;
    resolvedCount: number;
    noResponseEscalated: number;
  }>;
}

const SimClockContext = createContext<SimClockState | undefined>(undefined);

export function SimClockProvider({ children }: { children: ReactNode }) {
  const [currentDay, setCurrentDay] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    getCurrentSimDay().then((r) => setCurrentDay(r.currentDay)).catch(() => {});
  }, []);

  const advance = useCallback(async (days: number) => {
    const res = await advanceSimClock(days);
    setCurrentDay(res.toDay);
    setRefreshTrigger((t) => t + 1);
    return res;
  }, []);

  const value = useMemo(
    () => ({ currentDay, refreshTrigger, advance }),
    [currentDay, refreshTrigger, advance],
  );

  return <SimClockContext.Provider value={value}>{children}</SimClockContext.Provider>;
}

export function useSimClock(): SimClockState {
  const ctx = useContext(SimClockContext);
  if (!ctx) throw new Error('useSimClock must be used within SimClockProvider');
  return ctx;
}

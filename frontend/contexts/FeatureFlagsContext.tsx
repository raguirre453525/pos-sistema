"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { DEFAULT_FLAGS, FeatureFlags } from "@/lib/featureFlagsService";

type FeatureFlagsState = {
  flags: FeatureFlags;
  setFlagsForCurrentAccount: (patch: Partial<FeatureFlags>) => void;
  setFlagsForAccount: (accountId: string, patch: Partial<FeatureFlags>) => void;
  saveFlags: (accountId: string, flags: FeatureFlags) => void;
  refresh: () => Promise<void>;
  loading: boolean;
};

const FeatureFlagsContext = createContext<FeatureFlagsState | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { features, refresh: authRefresh, loading: authLoading, businessId } = useAuth();

  const flags: FeatureFlags = useMemo(() => {
    if (!features) return { ...DEFAULT_FLAGS };
    return {
      moduloClientes: features.moduloClientes,
      moduloPromos: features.moduloPromos,
      moduloReportes: features.moduloReportes,
      permitirAjusteInflacion: features.permitirAjusteInflacion,
    };
  }, [features]);

  const refresh = useCallback(async () => {
    await authRefresh();
  }, [authRefresh]);

  // Legacy setters — Phase 2 flags live on backend via PUT /api/admin/businesses/{id}/features.
  // Keep as no-ops to avoid breaking old callers; Configuracion now uses API directly.
  const setFlagsForCurrentAccount = useCallback((p: Partial<FeatureFlags>) => {
    void p;
  }, []);

  const setFlagsForAccount = useCallback((a: string, p: Partial<FeatureFlags>) => {
    void a; void p;
  }, []);

  const saveFlags = useCallback((a: string, f: FeatureFlags) => {
    void a; void f;
  }, []);

  // keep reactive when businessId changes (ensures consumers re-render on login switch)
  void businessId;

  return (
    <FeatureFlagsContext.Provider value={{ flags, setFlagsForCurrentAccount, setFlagsForAccount, saveFlags, refresh, loading: authLoading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagsState {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  return ctx;
}

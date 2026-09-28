"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { API_URL, normalizeFeatures, TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY_LEGACY, getStoredToken, setStoredToken } from "@/lib/api";
import type { AuthFeatureFlags } from "@/lib/api";
import { DEFAULT_FLAGS } from "@/lib/featureFlagsService";

export type Role = "SuperAdmin" | "Admin" | "User";
export type AccountId = "negocio-a" | "negocio-b" | "default";

export const ACCOUNT_LABELS: Record<AccountId, string> = {
  "negocio-a": "Negocio A (Kiosco)",
  "negocio-b": "Negocio B (Repuestera)",
  "default": "Default",
};

const REPUESTERA_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

export type UserProfile = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  businessId: string | null;
  businessName: string | null;
  features: AuthFeatureFlags;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    // atob may contain unicode; JSON claims are ascii-safe for businessName
    const json = typeof window !== "undefined" && typeof window.atob === "function" ? window.atob(padded) : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getBusinessNameFromToken(token: string | null): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const bn = (payload["businessName"] ?? payload["BusinessName"] ?? payload["business_name"]) as unknown;
  if (typeof bn === "string" && bn.trim()) return bn.trim();
  return null;
}

function getBusinessIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const bid = (payload["businessId"] ?? payload["BusinessId"] ?? payload["business_id"]) as unknown;
  if (typeof bid === "string" && bid.trim()) return bid.trim();
  return null;
}

function businessIdToAccountId(businessId: string | null | undefined): AccountId {
  if (!businessId) return "default";
  const normalized = businessId.toLowerCase();
  if (normalized === REPUESTERA_BUSINESS_ID.toLowerCase()) return "negocio-b";
  // any other guid -> map to negocio-a for backwards compat
  return "negocio-a";
}

function normalizeRole(raw: string | undefined | null): Role {
  if (raw === "SuperAdmin" || raw === "Admin" || raw === "User") return raw;
  // backend may return different casing? normalize
  const lower = (raw ?? "").toLowerCase();
  if (lower === "superadmin") return "SuperAdmin";
  if (lower === "admin") return "Admin";
  if (lower === "user") return "User";
  return "User";
}

type AuthState = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  role: Role;
  accountId: AccountId;
  businessId: string | null;
  businessName: string | null;
  features: AuthFeatureFlags;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => void;
  refresh: () => Promise<void>;
  setRole: (r: Role) => void;
  setAccountId: (a: AccountId) => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // hydrate on mount
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    setTokenState(stored);
    // validate token via /api/auth/me — but also hydrate businessName from JWT as fallback
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          id: string;
          username: string;
          fullName: string;
          role: string;
          businessId: string | null;
          businessName?: string | null;
          // also support PascalCase from backend
          BusinessId?: string | null;
          BusinessName?: string | null;
          features: unknown;
        };
        if (cancelled) return;
        const features = normalizeFeatures(data.features);
        const tokenBn = getBusinessNameFromToken(stored);
        const tokenBid = getBusinessIdFromToken(stored);
        // normalize Pascal/camel for businessName/businessId
        const rawBn = (data.businessName ?? (data as unknown as Record<string, unknown>)["BusinessName"] ?? tokenBn ?? null) as string | null;
        const rawBid = (data.businessId ?? (data as unknown as Record<string, unknown>)["BusinessId"] ?? tokenBid ?? null) as string | null;
        const businessNameVal = typeof rawBn === "string" && rawBn.trim() ? rawBn.trim() : tokenBn ?? null;
        const businessIdVal = typeof rawBid === "string" && rawBid.trim() ? rawBid.trim() : tokenBid ?? null;
        const profile: UserProfile = {
          id: data.id,
          username: data.username,
          fullName: data.fullName,
          role: normalizeRole(data.role),
          businessId: businessIdVal,
          businessName: businessNameVal,
          features,
        };
        setUser(profile);
      } catch {
        if (!cancelled) {
          // fallback: try to at least decode JWT so UI shows businessName without API
          const payload = decodeJwtPayload(stored);
          if (payload) {
            try {
              const roleRaw = (payload["role"] ?? payload["Role"] ?? payload[Object.keys(payload).find((k) => k.toLowerCase().includes("role")) ?? ""] ?? "") as string;
              const bid = getBusinessIdFromToken(stored);
              const bn = getBusinessNameFromToken(stored);
              const uid = (payload["sub"] ?? payload["nameid"] ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]) as string | undefined;
              const uname = (payload["unique_name"] ?? payload["name"] ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ?? "") as string;
              const fname = (payload["fullName"] ?? payload["FullName"] ?? uname) as string;
              if (uid || uname) {
                const fallbackProfile: UserProfile = {
                  id: typeof uid === "string" && uid ? uid : "jwt-user",
                  username: typeof uname === "string" && uname ? uname : "unknown",
                  fullName: typeof fname === "string" && fname ? fname : typeof uname === "string" ? uname : "Usuario",
                  role: normalizeRole(typeof roleRaw === "string" ? roleRaw : undefined),
                  businessId: bid,
                  businessName: bn,
                  features: { ...DEFAULT_FLAGS },
                };
                setUser(fallbackProfile);
                setLoading(false);
                return;
              }
            } catch {}
          }
          setStoredToken(null);
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        data = text ? { message: text } : null;
      }
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          if (typeof obj.message === "string") message = obj.message;
          else if (typeof obj.title === "string") message = obj.title;
          else if (typeof obj.detail === "string") message = obj.detail;
          else if (typeof obj.error === "string") message = obj.error;
          if (obj.errors && typeof obj.errors === "object") {
            const errs = obj.errors as Record<string, string[]>;
            const first = Object.values(errs).flat()[0];
            if (first) message = first;
          }
        }
        if (typeof data === "string" && data.length < 500) message = data;
        throw new Error(message);
      }
      const obj = data as Record<string, unknown>;
      const tokenValue = (obj.token ?? obj.Token) as string | undefined;
      if (!tokenValue) throw new Error("Token no recibido del servidor");
      const rawFeatures = (obj.features ?? obj.Features) as unknown;
      const features = normalizeFeatures(rawFeatures);
      const role = normalizeRole((obj.role ?? obj.Role) as string | undefined);
      // businessName/businessId may be Pascal or camel; fallback to JWT claim if missing
      const tokenBusinessName = getBusinessNameFromToken(tokenValue);
      const tokenBusinessId = getBusinessIdFromToken(tokenValue);
      const rawBusinessId = ((obj.businessId ?? obj.BusinessId) as string | null) ?? tokenBusinessId ?? null;
      const rawBusinessName = ((obj.businessName ?? obj.BusinessName) as string | null) ?? tokenBusinessName ?? null;
      const businessIdVal = typeof rawBusinessId === "string" && rawBusinessId.trim() ? rawBusinessId.trim() : tokenBusinessId ?? null;
      const businessNameVal = typeof rawBusinessName === "string" && rawBusinessName.trim() ? rawBusinessName.trim() : tokenBusinessName ?? null;
      const profile: UserProfile = {
        id: (obj.id ?? obj.Id) as string,
        username: (obj.username ?? obj.Username) as string,
        fullName: (obj.fullName ?? obj.FullName) as string,
        role,
        businessId: businessIdVal,
        businessName: businessNameVal,
        features,
      };
      setStoredToken(tokenValue);
      // also clean old mock key if any
      try {
        localStorage.removeItem("pos_auth_user");
      } catch {}
      setTokenState(tokenValue);
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setTokenState(null);
    setUser(null);
    // also clear legacy token keys explicitly
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY_LEGACY);
      localStorage.removeItem("pos_auth_user");
    } catch {}
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const refresh = useCallback(async () => {
    const stored = getStoredToken() ?? token;
    if (!stored) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        id: string;
        username: string;
        fullName: string;
        role: string;
        businessId: string | null;
        businessName?: string | null;
        BusinessId?: string | null;
        BusinessName?: string | null;
        features: unknown;
      };
      const features = normalizeFeatures(data.features);
      const tokenBn = getBusinessNameFromToken(stored);
      const tokenBid = getBusinessIdFromToken(stored);
      const rawBn = (data.businessName ?? (data as unknown as Record<string, unknown>)["BusinessName"] ?? tokenBn ?? null) as string | null;
      const rawBid = (data.businessId ?? (data as unknown as Record<string, unknown>)["BusinessId"] ?? tokenBid ?? null) as string | null;
      setUser((prev) => {
        if (prev) {
          return {
            ...prev,
            features,
            businessId: (typeof rawBid === "string" && rawBid.trim() ? rawBid.trim() : tokenBid) ?? prev.businessId,
            businessName: (typeof rawBn === "string" && rawBn.trim() ? rawBn.trim() : tokenBn) ?? prev.businessName,
            role: normalizeRole(data.role),
            fullName: data.fullName ?? prev.fullName,
            username: data.username ?? prev.username,
          };
        }
        return {
          id: data.id,
          username: data.username,
          fullName: data.fullName,
          role: normalizeRole(data.role),
          businessId: (typeof rawBid === "string" && rawBid.trim() ? rawBid.trim() : tokenBid) ?? null,
          businessName: (typeof rawBn === "string" && rawBn.trim() ? rawBn.trim() : tokenBn) ?? null,
          features,
        };
      });
    } catch {
      // silent — keep previous user, but if 401 we could logout; caller decides
    }
  }, [token]);

  const setRole = useCallback((_: Role) => {
    void _;
  }, []);

  const setAccountId = useCallback((_: AccountId) => {
    // Phase 2: accountId is derived from JWT businessId, not manually toggled.
    void _;
  }, []);

  const derivedRole: Role = useMemo(() => user?.role ?? "User", [user]);
  const derivedAccountId: AccountId = useMemo(() => businessIdToAccountId(user?.businessId ?? getBusinessIdFromToken(token)), [user, token]);
  const derivedBusinessId = useMemo(() => user?.businessId ?? getBusinessIdFromToken(token) ?? null, [user, token]);
  const derivedBusinessName = useMemo(() => {
    const fromUser = user?.businessName?.trim();
    if (fromUser) return fromUser;
    const fromToken = getBusinessNameFromToken(token);
    if (fromToken) return fromToken;
    return null;
  }, [user, token]);
  const derivedFeatures: AuthFeatureFlags = useMemo(() => user?.features ?? { ...DEFAULT_FLAGS }, [user]);

  const value: AuthState = {
    user,
    token,
    loading,
    role: derivedRole,
    accountId: derivedAccountId,
    businessId: derivedBusinessId,
    businessName: derivedBusinessName,
    features: derivedFeatures,
    login,
    logout,
    refresh,
    setRole,
    setAccountId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

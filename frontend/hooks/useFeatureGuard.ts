"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

type GuardOptions = {
  requireClientes?: boolean;
  requirePromos?: boolean;
  requireReportes?: boolean;
  requireInflacion?: boolean;
  allowedRoles?: ("SuperAdmin" | "Admin" | "User")[];
  denyRoles?: ("SuperAdmin" | "Admin" | "User")[];
  redirectTo?: string;
};

export function useFeatureGuard(opts: GuardOptions = {}) {
  const router = useRouter();
  const { role } = useAuth();
  const { flags } = useFeatureFlags();

  const redirectTo = opts.redirectTo ?? "/Ventas";

  let allowed = true;
  let reason: string | null = null;

  if (opts.allowedRoles && !opts.allowedRoles.includes(role)) {
    allowed = false;
    reason = `role ${role} not in allowed`;
  }
  if (opts.denyRoles && opts.denyRoles.includes(role)) {
    allowed = false;
    reason = `role ${role} denied`;
  }
  if (opts.requireClientes && !flags.moduloClientes) {
    allowed = false;
    reason = "moduloClientes off";
  }
  if (opts.requirePromos && !flags.moduloPromos) {
    allowed = false;
    reason = "moduloPromos off";
  }
  if (opts.requireReportes && !flags.moduloReportes) {
    allowed = false;
    reason = "moduloReportes off";
  }
  if (opts.requireInflacion && !flags.permitirAjusteInflacion) {
    allowed = false;
    reason = "permitirAjusteInflacion off";
  }

  useEffect(() => {
    if (!allowed) {
      router.replace(redirectTo);
    }
  }, [allowed, redirectTo, router]);

  return { allowed, reason, role, flags };
}

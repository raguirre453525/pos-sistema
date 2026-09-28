"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type AdminGuardOptions = {
  redirectTo?: string;
};

export function useAdminGuard(opts: AdminGuardOptions = {}) {
  const router = useRouter();
  const { role, loading, user } = useAuth();
  const redirectTo = opts.redirectTo ?? "/Ventas";

  const allowed = !loading && !!user && role === "SuperAdmin";

  useEffect(() => {
    if (!loading && user && role !== "SuperAdmin") {
      router.replace(redirectTo);
    }
  }, [loading, user, role, redirectTo, router]);

  return { allowed, role, loading };
}

"use client";

import { useFeatureGuard } from "@/hooks/useFeatureGuard";

type Props = {
  requireClientes?: boolean;
  requirePromos?: boolean;
  requireReportes?: boolean;
  requireInflacion?: boolean;
  allowedRoles?: ("SuperAdmin" | "Admin" | "User")[];
  denyRoles?: ("SuperAdmin" | "Admin" | "User")[];
  redirectTo?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function FeatureGuard({ children, fallback = null, ...opts }: Props) {
  const { allowed } = useFeatureGuard(opts);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

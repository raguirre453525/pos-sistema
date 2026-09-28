export type FeatureFlags = {
  moduloClientes: boolean;
  moduloPromos: boolean;
  moduloReportes: boolean;
  permitirAjusteInflacion: boolean;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  moduloClientes: true,
  moduloPromos: true,
  moduloReportes: true,
  permitirAjusteInflacion: true,
};

export function keyFor(accountId: string): string {
  return `pos_features_${accountId}`;
}

export function getFlags(accountId: string): FeatureFlags {
  const fallback = accountId?.trim() ? accountId : "default";
  const key = keyFor(fallback);
  try {
    if (typeof window === "undefined" || !window.localStorage) return { ...DEFAULT_FLAGS };
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_FLAGS };
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return {
      moduloClientes: typeof parsed.moduloClientes === "boolean" ? parsed.moduloClientes : DEFAULT_FLAGS.moduloClientes,
      moduloPromos: typeof parsed.moduloPromos === "boolean" ? parsed.moduloPromos : DEFAULT_FLAGS.moduloPromos,
      moduloReportes: typeof parsed.moduloReportes === "boolean" ? parsed.moduloReportes : DEFAULT_FLAGS.moduloReportes,
      permitirAjusteInflacion: typeof parsed.permitirAjusteInflacion === "boolean" ? parsed.permitirAjusteInflacion : DEFAULT_FLAGS.permitirAjusteInflacion,
    };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export function setFlags(accountId: string, flags: FeatureFlags): void {
  const fallback = accountId?.trim() ? accountId : "default";
  const key = keyFor(fallback);
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.setItem(key, JSON.stringify(flags));
  } catch {
    // ignore quota errors
  }
}

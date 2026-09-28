/** Centralized backend client. Base URL via NEXT_PUBLIC_API_URL or fallback to http://localhost:5240 (avoids dev cert). */
export const API_URL =
  (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")) || "http://localhost:5240";

// ---------- Auth token storage (Phase 2: pos_token is source of truth) ----------
export const TOKEN_STORAGE_KEY = "pos_token";
export const TOKEN_STORAGE_KEY_LEGACY = "pos_jwt_token";

export function getStoredToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const primary = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (primary) return primary;
    const legacy = localStorage.getItem(TOKEN_STORAGE_KEY_LEGACY);
    if (legacy) return legacy;
    return null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (typeof window === "undefined") return;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      // keep legacy in sync for any old readers, but primary is pos_token
      localStorage.setItem(TOKEN_STORAGE_KEY_LEGACY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY_LEGACY);
      // also clean old mock key
      localStorage.removeItem("pos_auth_user");
    }
  } catch {}
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

function buildAuthHeaders(initHeaders?: HeadersInit): Record<string, string> {
  const token = getStoredToken();
  const base: Record<string, string> = {};
  if (token) base["Authorization"] = `Bearer ${token}`;
  if (!initHeaders) return base;
  // normalize HeadersInit to record
  if (initHeaders instanceof Headers) {
    initHeaders.forEach((v, k) => (base[k] = v));
  } else if (Array.isArray(initHeaders)) {
    initHeaders.forEach(([k, v]) => (base[k] = v as string));
  } else {
    Object.assign(base, initHeaders as Record<string, string>);
  }
  if (token && !base["Authorization"] && !base["authorization"]) {
    base["Authorization"] = `Bearer ${token}`;
  }
  return base;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = buildAuthHeaders(init?.headers);
  const hasBody = init?.body !== undefined && init?.body !== null;
  // For JSON requests we always want Content-Type, but for auth headers we merge
  const headers: Record<string, string> = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
    // init headers last so explicit overrides win, but ensure Authorization stays
    ...(() => {
      if (!init?.headers) return {};
      if (init.headers instanceof Headers) {
        const r: Record<string, string> = {};
        init.headers.forEach((v, k) => (r[k] = v));
        return r;
      }
      if (Array.isArray(init.headers)) {
        const r: Record<string, string> = {};
        (init.headers as [string, string][]).forEach(([k, v]) => (r[k] = v));
        return r;
      }
      return init.headers as Record<string, string>;
    })(),
  };
  // ensure auth header not accidentally overwritten by init without auth
  if (!headers["Authorization"] && !headers["authorization"] && authHeaders["Authorization"]) {
    headers["Authorization"] = authHeaders["Authorization"];
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : (null as unknown as T);
  if (!res.ok) {
    // Try to extract validation message from ASP.NET problem details
    let message = `HTTP ${res.status}`;
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj.title === "string") message = obj.title;
      if (typeof obj.detail === "string") message = obj.detail;
      // FluentValidation AutoValidation returns { errors: { field: [...] }, title, status }
      if (obj.errors && typeof obj.errors === "object") {
        const errs = obj.errors as Record<string, string[]>;
        const first = Object.values(errs).flat()[0];
        if (first) message = first;
      }
      // Sales stock error is plain string or ArgumentException -> { message }
      if (typeof obj.message === "string") message = obj.message as string;
      // sometimes body is { error: "..."} 
      if (typeof obj.error === "string") message = obj.error as string;
    }
    if (typeof data === "string" && data.length < 500) message = data;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

// ---------- Types ----------
export type ProductDto = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  unit?: "un" | "kg" | string | null;
  minStock?: number | null;
  isSoldByWeight?: boolean;
};

export type CreateProductDto = {
  sku: string;
  name: string;
  price: number;
  barcode?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  unit?: "un" | "kg" | string | null;
  minStock?: number | null;
};

export type StockAdjustmentDto = {
  delta: number;
  reason: string;
};

export type StockAdjustmentResponseDto = {
  product: ProductDto;
  delta: number;
  resultingStock: number;
  reason: string;
  adjustedAt: string;
};

export type CreateSaleItemDto = {
  productId: string;
  quantity: number;
};

export type CreateSaleComboDto = {
  promotionId: string;
  quantity: number;
};

export type CreateSaleDto = {
  items: CreateSaleItemDto[];
  paymentMethod: 0 | 1 | 2; // Cash=0, MercadoPago=1, Card=2 (Débito/Crédito)
  customerId?: string | null;
  isCredit?: boolean;
  dueDate?: string | null;
  dueDays?: number | null;
  combos?: CreateSaleComboDto[];
};

export type SalePromotionDto = {
  promotionId: string;
  promotionName: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalOriginal: number;
  totalPaid: number;
  saving: number;
};

export type SaleDto = {
  id: string;
  date: string;
  paymentMethod: string; // "Cash" / "MercadoPago" serialized as string via backend
  total: number;
  items: SaleItemDto[];
  salePromotions?: SalePromotionDto[];
  customerId?: string | null;
  isCredit?: boolean;
  paidAmount?: number;
  dueDate?: string | null;
  paidAt?: string | null;
  creditStatus?: string | null;
};

export type SaleItemDto = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  promotionId?: string | null;
  promotionName?: string | null;
  isFromCombo?: boolean;
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type LowStockDto = {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  threshold: number;
};

export type StockAuditDto = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  delta: number;
  resultingStock: number;
  reason: string;
  adjustedAt: string;
};

export type CategoryDto = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
};

export type CreateCategoryDto = {
  name: string;
  description?: string | null;
};

export type UpdateCategoryDto = {
  name: string;
  description?: string | null;
};

export type UpdateProductDto = {
  name: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  unit?: "un" | "kg" | string | null;
  minStock?: number | null;
};

export type ProductPriceHistoryDto = {
  id: string;
  productId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  reason: string | null;
  changePercent: number;
};

export type BulkPriceAdjustmentDto = {
  categoryId?: string | null;
  productIds?: string[];
  percentage?: number | null;
  fixedAmount?: number | null;
  reason: string;
  rounding?: number | null;
};

export type BulkPriceAdjustmentResultDto = {
  affectedCount: number;
  histories: ProductPriceHistoryDto[];
};

// ---------- Products ----------
export function getProducts() {
  return apiFetch<ProductDto[]>("/api/Products");
}

export function getProduct(id: string) {
  return apiFetch<ProductDto>(`/api/Products/${id}`);
}

export function createProduct(dto: CreateProductDto) {
  return apiFetch<ProductDto>("/api/Products", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateProduct(id: string, dto: UpdateProductDto) {
  return apiFetch<void>(`/api/Products/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function deleteProduct(id: string) {
  return apiFetch<void>(`/api/Products/${id}`, { method: "DELETE" });
}

export function adjustStock(id: string, dto: StockAdjustmentDto) {
  return apiFetch<StockAdjustmentResponseDto>(`/api/Products/${id}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function getProductPriceHistory(
  productId: string,
  params?: { from?: string; to?: string; page?: number; pageSize?: number }
) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  qs.set("page", String(params?.page ?? 1));
  qs.set("pageSize", String(params?.pageSize ?? 20));
  return apiFetch<PagedResult<ProductPriceHistoryDto>>(
    `/api/Products/${productId}/price-history?${qs.toString()}`
  );
}

// ---------- Sales ----------
export function createSale(dto: CreateSaleDto) {
  return apiFetch<SaleDto>("/api/Sales", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

// ---------- Reports ----------
export type DailySaleDto = { date: string; total: number; count: number };
export type CategorySaleDto = { category: string; total: number; quantity: number };
export type TopProductDto = { productId: string; sku: string; name: string; quantity: number; revenue: number };
export type DashboardSummaryDto = {
  salesCount: number;
  totalRevenue: number;
  productsSoldQuantity: number;
  ticketAverage: number;
  lowStockCount: number;
  dailySales: DailySaleDto[];
  salesByCategory: CategorySaleDto[];
  topProducts: TopProductDto[];
  recentSales: SaleDto[];
};

export function getLowStock(threshold = 5) {
  return apiFetch<LowStockDto[]>(`/api/reports/low-stock?threshold=${threshold}`);
}

export function getDashboard(params: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<DashboardSummaryDto>(`/api/reports/dashboard${suffix}`);
}

export function getSalesReport(params: {
  from?: string;
  to?: string;
  paymentMethod?: 0 | 1 | 2;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.paymentMethod !== undefined) qs.set("paymentMethod", String(params.paymentMethod));
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 20));
  return apiFetch<PagedResult<SaleDto>>(`/api/reports/sales?${qs.toString()}`);
}

export function getStockAudits(params: {
  productId?: string;
  from?: string;
  to?: string;
  reasonContains?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.productId) qs.set("productId", params.productId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.reasonContains) qs.set("reasonContains", params.reasonContains);
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 20));
  return apiFetch<PagedResult<StockAuditDto>>(`/api/reports/stock-audits?${qs.toString()}`);
}

// ---------- Assistant ----------
export type ChatMessageDto = { role: "user" | "assistant"; content: string };
export type ChatRequestDto = { message: string; history?: ChatMessageDto[] };
export type ProductProposal = {
  name: string;
  sku: string | null;
  price: number | null;
  stockDelta: number | null;
  barcode: string | null;
  description: string | null;
  categoryNames: string[] | null;
  exists: boolean;
  existingId: string | null;
  currentPrice: number | null;
  currentStock: number | null;
  missingFields: string[];
  action: string;
};
export type ProposalResponse = {
  proposals: ProductProposal[];
  naturalReply: string;
  needsConfirmation: boolean;
  hasMissingData: boolean;
};
export type ChatResponseDto = { reply: string; provider: string; proposal?: ProposalResponse | null };
export type ProvidersResponseDto = { current: string; available: string[] };

export function askAssistant(message: string, history?: ChatMessageDto[]) {
  return apiFetch<ChatResponseDto>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message, history: history ?? [] }),
  });
}

export function confirmAssistantProposal(history?: ChatMessageDto[]) {
  return askAssistant("confirmar", history);
}

export function getAssistantProviders() {
  return apiFetch<ProvidersResponseDto>("/api/assistant/providers");
}

// ---------- Categories ----------
export function getCategories() {
  return apiFetch<CategoryDto[]>("/api/Categories");
}

export function getCategory(id: string) {
  return apiFetch<CategoryDto>(`/api/Categories/${id}`);
}

export function createCategory(dto: CreateCategoryDto) {
  return apiFetch<CategoryDto>("/api/Categories", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function updateCategory(id: string, dto: UpdateCategoryDto) {
  return apiFetch<CategoryDto>(`/api/Categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function deleteCategory(id: string) {
  return apiFetch<void>(`/api/Categories/${id}`, { method: "DELETE" });
}

export function getCategoryProducts(categoryId: string) {
  return apiFetch<ProductDto[]>(`/api/Categories/${categoryId}/products`);
}

export function assignCategory(productId: string, categoryId: string) {
  return apiFetch<void>(`/api/Products/${productId}/categories/${categoryId}`, {
    method: "POST",
  });
}

export function removeCategory(productId: string, categoryId: string) {
  return apiFetch<void>(`/api/Products/${productId}/categories/${categoryId}`, {
    method: "DELETE",
  });
}

export function bulkAdjustPrices(dto: BulkPriceAdjustmentDto) {
  return apiFetch<BulkPriceAdjustmentResultDto>("/api/Products/bulk-price-adjustment", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

// ---------- Customers ----------
export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  balance: number;
  lastPurchaseAt: string | null;
  daysSinceDebt: number | null;
  pendingSalesCount: number;
  createdAt: string;
};

export type CustomerPaymentDto = {
  id: string;
  customerId: string;
  amount: number;
  paidAt: string;
  note: string | null;
  saleId: string | null;
};

export type CustomerDetailDto = {
  customer: CustomerDto;
  pendingSales: SaleDto[];
  payments: CustomerPaymentDto[];
  allCreditSales: SaleDto[];
};

export type CreateCustomerDto = { name: string; phone?: string | null; note?: string | null };
export type CreatePaymentDto = { amount: number; note?: string | null; saleId?: string | null };

export function getCustomers() {
  return apiFetch<CustomerDto[]>("/api/Customers");
}
export function getCustomerDetail(id: string) {
  return apiFetch<CustomerDetailDto>(`/api/Customers/${id}/detail`);
}
export function createCustomer(dto: CreateCustomerDto) {
  return apiFetch<CustomerDto>("/api/Customers", { method: "POST", body: JSON.stringify(dto) });
}
export function updateCustomer(id: string, dto: CreateCustomerDto) {
  return apiFetch<CustomerDto>(`/api/Customers/${id}`, { method: "PUT", body: JSON.stringify(dto) });
}
export function deleteCustomer(id: string) {
  return apiFetch<void>(`/api/Customers/${id}`, { method: "DELETE" });
}
export function registerCustomerPayment(customerId: string, dto: CreatePaymentDto) {
  return apiFetch<CustomerPaymentDto>(`/api/Customers/${customerId}/payments`, { method: "POST", body: JSON.stringify(dto) });
}

// ---------- Promotions ----------
export type PromotionLineDto = { productId: string; quantity: number };
export type PromotionProductDto = { productId: string; productName: string; sku: string; unitPrice: number; quantity: number; lineTotal: number };
export type PromotionDto = {
  id: string;
  name: string;
  description: string | null;
  type: 0 | 1;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  comboPrice: number | null;
  discountPercentage: number | null;
  lines: PromotionProductDto[];
  products: ProductDto[]; // compat
  totalOriginalPrice: number | null;
  savingAmount: number | null;
  savingPercent: number | null;
  isCurrentlyActive: boolean;
  imageUrl?: string | null;
};

export type CreatePromotionDto = {
  name: string;
  description?: string | null;
  type: 0 | 1;
  isActive: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  comboPrice?: number | null;
  discountPercentage?: number | null;
  lines?: PromotionLineDto[];
  productIds?: string[]; // compat
  imageUrl?: string | null;
};

export type UpdatePromotionDto = CreatePromotionDto;

export function getPromotions() {
  return apiFetch<PromotionDto[]>("/api/Promotions");
}
export function getActivePromotions() {
  return apiFetch<PromotionDto[]>("/api/Promotions/active");
}
export function getPromotion(id: string) {
  return apiFetch<PromotionDto>(`/api/Promotions/${id}`);
}
export function createPromotion(dto: CreatePromotionDto) {
  return apiFetch<PromotionDto>("/api/Promotions", { method: "POST", body: JSON.stringify(dto) });
}
export function updatePromotion(id: string, dto: UpdatePromotionDto) {
  return apiFetch<PromotionDto>(`/api/Promotions/${id}`, { method: "PUT", body: JSON.stringify(dto) });
}
export function deletePromotion(id: string) {
  return apiFetch<void>(`/api/Promotions/${id}`, { method: "DELETE" });
}
export function togglePromotion(id: string) {
  return apiFetch<PromotionDto>(`/api/Promotions/${id}/toggle`, { method: "PATCH" });
}

export async function uploadProductImage(id: string, file: File) {
  // FIX: validación cliente evita crash y request innecesario; mensajes claros para UI
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new ApiError("Archivo muy grande (máximo 5MB)", 400, { message: "Archivo muy grande (máximo 5MB)" });
  if (file.type && !file.type.startsWith("image/")) throw new ApiError("Formato no soportado (solo imágenes)", 400, { message: "Formato no soportado (solo imágenes)" });
  if (!allowedExts.includes(ext) && file.type && !file.type.startsWith("image/")) throw new ApiError("Extensión no permitida (jpg, jpeg, png, webp)", 400, { message: "Extensión no permitida" });
  const form = new FormData();
  form.append("file", file);
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}/api/Products/${id}/image`, { method: "POST", body: form, headers: headers as HeadersInit });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { message: text } : null; }
    if (!res.ok) {
      const msg = (data?.message ?? data?.title ?? data?.detail ?? (typeof data === "string" ? data : null) ?? text) || `HTTP ${res.status}`;
      throw new ApiError(msg, res.status, data);
    }
    return data as { imageUrl: string };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error ? e.message : "Error de red al subir imagen", 0, e);
  }
}

export async function uploadPromotionImage(id: string, file: File) {
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new ApiError("Archivo muy grande (máximo 5MB)", 400, { message: "Archivo muy grande (máximo 5MB)" });
  if (file.type && !file.type.startsWith("image/")) throw new ApiError("Formato no soportado (solo imágenes)", 400, { message: "Formato no soportado (solo imágenes)" });
  if (!allowedExts.includes(ext) && file.type && !file.type.startsWith("image/")) throw new ApiError("Extensión no permitida (jpg, jpeg, png, webp)", 400, { message: "Extensión no permitida" });
  const form = new FormData();
  form.append("file", file);
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}/api/Promotions/${id}/image`, { method: "POST", body: form, headers: headers as HeadersInit });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { message: text } : null; }
    if (!res.ok) {
      const msg = (data?.message ?? data?.title ?? data?.detail ?? (typeof data === "string" ? data : null) ?? text) || `HTTP ${res.status}`;
      throw new ApiError(msg, res.status, data);
    }
    return data as { imageUrl: string };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error ? e.message : "Error de red al subir imagen", 0, e);
  }
}

export async function uploadProductImageTemp(file: File) {
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new ApiError("Archivo muy grande (máximo 5MB)", 400, { message: "Archivo muy grande (máximo 5MB)" });
  if (file.type && !file.type.startsWith("image/")) throw new ApiError("Formato no soportado (solo imágenes)", 400, { message: "Formato no soportado (solo imágenes)" });
  if (!allowedExts.includes(ext) && file.type && !file.type.startsWith("image/")) throw new ApiError("Extensión no permitida (jpg, jpeg, png, webp)", 400, { message: "Extensión no permitida" });
  const form = new FormData();
  form.append("file", file);
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_URL}/api/Products/image-upload`, { method: "POST", body: form, headers: headers as HeadersInit });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text ? { message: text } : null; }
    if (!res.ok) {
      const msg = (data?.message ?? data?.title ?? data?.detail ?? (typeof data === "string" ? data : null) ?? text) || `HTTP ${res.status}`;
      throw new ApiError(msg, res.status, data);
    }
    return data as { imageUrl: string };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error ? e.message : "Error de red al subir imagen", 0, e);
  }
}

// ---------- Auth (Phase 2) ----------
export type AuthFeatureFlags = {
  moduloClientes: boolean;
  moduloPromos: boolean;
  moduloReportes: boolean;
  permitirAjusteInflacion: boolean;
};

export type LoginResponseDto = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  businessId: string | null;
  businessName?: string | null;
  token: string;
  features: AuthFeatureFlags;
};

export type MeResponseDto = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  businessId: string | null;
  businessName: string | null;
  features: AuthFeatureFlags;
};

export function normalizeFeatures(raw: unknown): AuthFeatureFlags {
  const fallback: AuthFeatureFlags = {
    moduloClientes: true,
    moduloPromos: true,
    moduloReportes: true,
    permitirAjusteInflacion: true,
  };
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  // support both camelCase and PascalCase from backend
  const pick = (camel: string, pascal: string): boolean | undefined => {
    const c = o[camel];
    const p = o[pascal];
    if (typeof c === "boolean") return c;
    if (typeof p === "boolean") return p;
    return undefined;
  };
  return {
    moduloClientes: pick("moduloClientes", "ModuloClientes") ?? fallback.moduloClientes,
    moduloPromos: pick("moduloPromos", "ModuloPromos") ?? fallback.moduloPromos,
    moduloReportes: pick("moduloReportes", "ModuloReportes") ?? fallback.moduloReportes,
    permitirAjusteInflacion: pick("permitirAjusteInflacion", "PermitirAjusteInflacion") ?? fallback.permitirAjusteInflacion,
  };
}

export async function loginApi(username: string, password: string): Promise<LoginResponseDto> {
  return apiFetch<LoginResponseDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchMeApi(): Promise<MeResponseDto> {
  const data = await apiFetch<MeResponseDto | (MeResponseDto & { features?: unknown })>("/api/auth/me", {
    method: "GET",
  });
  // normalize features in case PascalCase
  const rawFeatures = (data as unknown as Record<string, unknown>)["features"];
  const normalized = normalizeFeatures(rawFeatures);
  return { ...(data as MeResponseDto), features: normalized };
}

// ---------- Admin Businesses (SuperAdmin) ----------
export type BusinessDto = {
  id: string;
  name: string;
  cuit: string | null;
  isActive: boolean;
  moduloClientes: boolean;
  moduloPromos: boolean;
  moduloReportes: boolean;
  permitirAjusteInflacion: boolean;
  usersCount: number;
  createdAt: string;
};

export type UpdateBusinessFeaturesDto = {
  moduloClientes: boolean;
  moduloPromos: boolean;
  moduloReportes: boolean;
  permitirAjusteInflacion: boolean;
};

export function getBusinesses(): Promise<BusinessDto[]> {
  return apiFetch<BusinessDto[]>("/api/admin/businesses");
}

export function getBusiness(id: string): Promise<BusinessDto> {
  return apiFetch<BusinessDto>(`/api/admin/businesses/${id}`);
}

export function updateBusinessFeatures(id: string, dto: UpdateBusinessFeaturesDto): Promise<BusinessDto> {
  return apiFetch<BusinessDto>(`/api/admin/businesses/${id}/features`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
}

export function createBusiness(dto: { name: string; cuit?: string | null; isActive?: boolean }): Promise<BusinessDto> {
  const payload: Record<string, unknown> = { name: dto.name, cuit: dto.cuit ?? null };
  if (dto.isActive !== undefined) payload.isActive = dto.isActive;
  return apiFetch<BusinessDto>("/api/admin/businesses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type CreateUserAdminDto = {
  username: string;
  password: string;
  fullName: string;
  role: string;
  businessId: string | null;
};

export function createUser(dto: CreateUserAdminDto): Promise<unknown> {
  return apiFetch<unknown>("/api/users", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export type AdminBusinessMetricsDto = {
  id: string;
  name: string;
  isActive: boolean;
  usersCount: number;
  totalSales: number;
  totalRevenue: number;
};

export type AdminMetricsDto = {
  totalBusinesses: number;
  activeBusinesses: number;
  inactiveBusinesses: number;
  totalUsers: number;
  totalSales: number;
  totalRevenue: number;
  businesses?: AdminBusinessMetricsDto[];
};

function normalizeMetrics(raw: unknown): AdminMetricsDto {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pickNum = (...keys: string[]): number => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "number" && !isNaN(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
    }
    return 0;
  };
  const base = {
    totalBusinesses: pickNum("totalBusinesses", "TotalBusinesses", "total_businesses", "TotalComercios"),
    activeBusinesses: pickNum("activeBusinesses", "ActiveBusinesses", "activos", "Activos"),
    inactiveBusinesses: pickNum("inactiveBusinesses", "InactiveBusinesses", "inactivos", "Inactivos"),
    totalUsers: pickNum("totalUsers", "TotalUsers", "total_usuarios"),
    totalSales: pickNum("totalSales", "TotalSales", "totalTransacciones", "TotalTransacciones", "totalVentas"),
    totalRevenue: pickNum("totalRevenue", "TotalRevenue", "montoTotal", "MontoTotal", "totalFacturado"),
  };
  // try to extract businesses array if present (extended metrics)
  const rawBusinesses = (o["businesses"] ?? o["Businesses"] ?? o["comercios"] ?? o["Comercios"]) as unknown;
  let businesses: AdminBusinessMetricsDto[] | undefined;
  if (Array.isArray(rawBusinesses)) {
    businesses = rawBusinesses
      .map((b) => {
        const obj = b as Record<string, unknown>;
        const id = (obj["id"] ?? obj["Id"] ?? "") as string;
        const name = (obj["name"] ?? obj["Name"] ?? "") as string;
        if (!id || !name) return null;
        const isActive = typeof obj["isActive"] === "boolean" ? obj["isActive"] : typeof obj["IsActive"] === "boolean" ? (obj["IsActive"] as boolean) : true;
        const usersCount = typeof obj["usersCount"] === "number" ? obj["usersCount"] : typeof obj["UsersCount"] === "number" ? (obj["UsersCount"] as number) : 0;
        const totalSales = typeof obj["totalSales"] === "number" ? obj["totalSales"] : typeof obj["TotalSales"] === "number" ? (obj["TotalSales"] as number) : 0;
        const totalRevenue = typeof obj["totalRevenue"] === "number" ? obj["totalRevenue"] : typeof obj["TotalRevenue"] === "number" ? (obj["TotalRevenue"] as number) : 0;
        return { id: String(id), name: String(name), isActive: Boolean(isActive), usersCount: Number(usersCount) || 0, totalSales: Number(totalSales) || 0, totalRevenue: Number(totalRevenue) || 0 };
      })
      .filter(Boolean) as AdminBusinessMetricsDto[];
  }
  return businesses ? { ...base, businesses } : base;
}

export async function getAdminMetrics(): Promise<AdminMetricsDto> {
  const raw = await apiFetch<unknown>("/api/admin/metrics");
  return normalizeMetrics(raw);
}

/** Centralized backend client. Base URL via NEXT_PUBLIC_API_URL or fallback to http://localhost:5240 (avoids dev cert). */
export const API_URL =
  (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")) || "http://localhost:5240";

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
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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
};

export type CreateProductDto = {
  sku: string;
  name: string;
  price: number;
  barcode?: string | null;
  description?: string | null;
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

export type CreateSaleDto = {
  items: CreateSaleItemDto[];
  paymentMethod: 0 | 1; // Cash=0, MercadoPago=1
};

export type SaleDto = {
  id: string;
  date: string;
  paymentMethod: string; // "Cash" / "MercadoPago" serialized as string via backend
  total: number;
  items: SaleItemDto[];
};

export type SaleItemDto = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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

export function deleteProduct(id: string) {
  return apiFetch<void>(`/api/Products/${id}`, { method: "DELETE" });
}

export function adjustStock(id: string, dto: StockAdjustmentDto) {
  return apiFetch<StockAdjustmentResponseDto>(`/api/Products/${id}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify(dto),
  });
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
  paymentMethod?: 0 | 1;
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

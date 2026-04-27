import { apiFetchPath } from "./api-url";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiFetchPath(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminOrderItem {
  id: number;
  giftNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  subtotal: number;
}

export interface AdminOrder {
  id: number;
  status: string;
  paymentMethod: string;
  installments: number;
  totalAmount: number;
  buyerName: string;
  asaasPaymentId: string | null;
  asaasStatus: string | null;
  muralMessage: string | null;
  whatsappSentAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  guestId: number | null;
  guestPhone: string | null;
  guestEmail: string | null;
  items: AdminOrderItem[];
}

export interface OrderSummary {
  totalPaid: number;
  totalPending: number;
  totalRefunded: number;
  countPaid: number;
  countPending: number;
  averageTicket: number;
}

export interface MuralMessage {
  id: number;
  authorName: string;
  message: string;
  source: string;
  orderId: number | null;
  createdAt: string;
  guestId: number | null;
}

export interface GiftCategory {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface ShopAdminSettings {
  showProgressBar: boolean;
  progressGoal: number | null;
  thankYouMessage: string | null;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export function fetchAdminOrders(weddingId: number, params?: { status?: string; method?: string; page?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.method) q.set("paymentMethod", params.method);
  if (params?.page) q.set("page", String(params.page));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return adminFetch<{ orders: AdminOrder[]; total: number; page: number; totalPages?: number; pages?: number }>(`/weddings/${weddingId}/orders${qs}`)
    .then((payload) => ({
      orders: (payload.orders ?? []).map((order) => ({
        ...order,
        items: Array.isArray(order.items) ? order.items : [],
      })),
      total: payload.total,
      page: payload.page,
      totalPages: payload.totalPages ?? payload.pages ?? 1,
    }));
}

export function fetchOrderSummary(weddingId: number) {
  return adminFetch<{
    totalPaid: number;
    totalPending: number;
    totalRefunded?: number;
    countPaid: number;
    countPending?: number;
    averageTicket?: number;
    avgTicket?: number;
  }>(`/weddings/${weddingId}/orders/summary`)
    .then((payload) => ({
      totalPaid: payload.totalPaid ?? 0,
      totalPending: payload.totalPending ?? 0,
      totalRefunded: payload.totalRefunded ?? 0,
      countPaid: payload.countPaid ?? 0,
      countPending: payload.countPending ?? 0,
      averageTicket: payload.averageTicket ?? payload.avgTicket ?? 0,
    }));
}

export interface AdminOrderDetailGuest {
  name: string;
  email: string | null;
  phone: string | null;
}

/** Resposta de GET /weddings/:id/orders/:orderId — itens vêm em `items`, não embutidos em `order`. */
export function fetchAdminOrderDetail(weddingId: number, orderId: number) {
  return adminFetch<{ order: AdminOrder; items: AdminOrderItem[]; guest: AdminOrderDetailGuest | null }>(
    `/weddings/${weddingId}/orders/${orderId}`,
  ).then((payload) => {
    const items = (payload.items ?? []).map((row) => ({
      id: row.id,
      giftNameSnapshot: row.giftNameSnapshot,
      quantity: Number(row.quantity),
      unitPriceSnapshot: parseFloat(String(row.unitPriceSnapshot)),
      subtotal: parseFloat(String(row.subtotal)),
    }));
    return {
      order: payload.order,
      items,
      guest: payload.guest ?? null,
    };
  });
}

export function cancelOrder(weddingId: number, orderId: number) {
  return adminFetch<{ ok: boolean }>(`/weddings/${weddingId}/orders/${orderId}/cancel`, { method: "POST" });
}

export function exportOrders(weddingId: number, format: "xlsx" | "csv" = "xlsx") {
  return apiFetchPath(`/weddings/${weddingId}/orders/export?format=${format}`);
}

// ---------------------------------------------------------------------------
// Mural
// ---------------------------------------------------------------------------

export function fetchMuralMessages(weddingId: number, params?: { source?: string }) {
  const q = params?.source ? `?source=${params.source}` : "";
  return adminFetch<{ messages: MuralMessage[] }>(`/weddings/${weddingId}/mural-messages${q}`);
}

// ---------------------------------------------------------------------------
// Gift categories
// ---------------------------------------------------------------------------

export function fetchAdminCategories(weddingId: number) {
  return adminFetch<{ categories: GiftCategory[] }>(`/weddings/${weddingId}/gift-categories`);
}

export function createCategory(weddingId: number, name: string, sortOrder?: number) {
  return adminFetch<{ category: GiftCategory }>(`/weddings/${weddingId}/gift-categories`, {
    method: "POST",
    body: JSON.stringify({ name, sortOrder }),
  });
}

export function updateCategory(weddingId: number, categoryId: number, data: Partial<Pick<GiftCategory, "name" | "sortOrder" | "active">>) {
  return adminFetch<{ category: GiftCategory }>(`/weddings/${weddingId}/gift-categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCategory(weddingId: number, categoryId: number) {
  return adminFetch<{ ok: boolean }>(`/weddings/${weddingId}/gift-categories/${categoryId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Gift toggle active
// ---------------------------------------------------------------------------

export function toggleGiftActive(weddingId: number, giftId: number, isActive: boolean) {
  return adminFetch<{ id: number; isActive: boolean }>(`/weddings/${weddingId}/gifts/${giftId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

// ---------------------------------------------------------------------------
// Shop settings
// ---------------------------------------------------------------------------

export function fetchAdminShopSettings(weddingId: number) {
  return adminFetch<ShopAdminSettings>(`/weddings/${weddingId}/shop-settings`);
}

export function updateAdminShopSettings(weddingId: number, data: Partial<ShopAdminSettings>) {
  return adminFetch<ShopAdminSettings>(`/weddings/${weddingId}/shop-settings`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

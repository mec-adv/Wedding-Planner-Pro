import { apiFetchPath } from "./api-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShopGift {
  id: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  category: string | null;
  isActive: boolean;
  isHoneymoonFund: boolean;
}

export interface ShopCategory {
  id: number;
  name: string;
  sortOrder: number;
}

export interface ShopSettings {
  showProgressBar: boolean;
  progressGoal: number | null;
  totalRaised: number | null;
  thankYouMessage: string | null;
}

export interface CartItem {
  giftId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  isHoneymoonFund: boolean;
  customPrice?: number;
}

export interface CreateOrderPayload {
  guestToken: string;
  buyerName: string;
  muralMessage?: string | null;
  paymentMethod: "pix" | "credit_card";
  // Card fields (one of token or raw)
  creditCardToken?: string;
  cardNumber?: string;
  cardHolderName?: string;
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardCcv?: string;
  holderName?: string;
  holderCpf?: string;
  holderEmail?: string;
  holderPhone?: string;
  holderPostalCode?: string;
  holderAddressNumber?: string;
  installments?: number;
  items: Array<{
    giftId: number;
    quantity: number;
    customPrice?: number;
  }>;
}

export interface CreateOrderResult {
  orderId: number;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  pixExpiresAt?: string | null;
}

export interface OrderStatusResult {
  orderId: number;
  status: string;
  asaasStatus: string | null;
}

export interface GuestOrder {
  id: number;
  status: string;
  paymentMethod: string;
  installments: number;
  totalAmount: number;
  buyerName: string;
  createdAt: string;
  paidAt: string | null;
  asaasPaymentId: string | null;
  items: Array<{
    id: number;
    giftNameSnapshot: string;
    quantity: number;
    unitPriceSnapshot: number;
    subtotal: number;
  }>;
}

export interface MuralMessagePayload {
  guestToken: string;
  authorName: string;
  message: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function shopFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
// Public shop endpoints
// ---------------------------------------------------------------------------

export function fetchShopGifts(weddingId: number) {
  return shopFetch<{ gifts: ShopGift[] }>(`/public/weddings/${weddingId}/gifts`);
}

export function fetchShopCategories(weddingId: number) {
  return shopFetch<{ categories: ShopCategory[] }>(`/public/weddings/${weddingId}/gift-categories`);
}

export function fetchShopSettings(weddingId: number) {
  return shopFetch<ShopSettings>(`/public/weddings/${weddingId}/shop-settings`);
}

export function createOrder(payload: CreateOrderPayload) {
  return shopFetch<CreateOrderResult>("/public/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchOrderStatus(orderId: number, guestToken: string) {
  return shopFetch<OrderStatusResult>(`/public/orders/${orderId}/status?token=${encodeURIComponent(guestToken)}`);
}

export function fetchGuestOrders(guestToken: string) {
  return shopFetch<{ orders: GuestOrder[] }>(`/public/orders?token=${encodeURIComponent(guestToken)}`);
}

export function postMuralMessage(payload: MuralMessagePayload) {
  return shopFetch<{ id: number }>("/public/mural-messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

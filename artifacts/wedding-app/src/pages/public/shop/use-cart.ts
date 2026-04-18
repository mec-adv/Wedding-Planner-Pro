import { useState, useEffect } from "react";
import type { CartItem } from "@/lib/shop-api";

const STORAGE_KEY = "shop_cart";

function loadCart(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // sessionStorage unavailable
  }
}

export function clearCart() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => { saveCart(items); }, [items]);

  function addItem(item: CartItem) {
    setItems((prev) => {
      // Honeymoon fund: always add as new line (price may differ)
      if (item.isHoneymoonFund) return [...prev, item];

      const existing = prev.find((i) => i.giftId === item.giftId);
      if (existing) {
        return prev.map((i) => i.giftId === item.giftId ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
  }

  function updateQuantity(index: number, quantity: number) {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((item, i) => i === index ? { ...item, quantity } : item);
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setItems([]);
    clearCart();
  }

  const totalAmount = items.reduce((sum, item) => {
    const price = item.isHoneymoonFund ? (item.customPrice ?? item.unitPrice) : item.unitPrice;
    return sum + price * item.quantity;
  }, 0);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, reset, totalAmount, totalItems };
}

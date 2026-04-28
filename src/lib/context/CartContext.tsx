'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartItem, Product } from '@/lib/types';
import notify from '@/lib/notify';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface CartContextType {
  cart: CartItem[];
  itemCount: number;
  subtotal: number;
  addToCart: (product: any, quantity?: number, unit?: string) => void;
  updateQuantity: (id: string, qty: number, unit?: string) => void;
  removeFromCart: (id: string, unit?: string) => void;
  clearCart: () => void;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Persistence
  const saveCart = useCallback(async (newCart: CartItem[], uid: string | null) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart-updated'));

    if (uid) {
      try {
        await setDoc(doc(db, 'carts', uid), { 
          userId: uid, 
          items: newCart, 
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        console.error('Failed to sync cart to cloud', err);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUserId(user?.uid || null);
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      if (user) {
        const snap = await getDoc(doc(db, 'carts', user.uid));
        if (snap.exists()) {
          const cloudCart = snap.data().items || [];
          // Simple merge logic: Cloud wins but could be more complex
          setCart(cloudCart.length > 0 ? cloudCart : localCart);
        } else {
          setCart(localCart);
        }
      } else {
        setCart(localCart);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const addToCart = useCallback((product: any, quantity: number = 1, unit: string = '') => {
    const pId = product.id || product.productId || '';
    const unitToUse = unit || product.unit || 'PCS';
    
    setCart(prev => {
      const idx = prev.findIndex(item => (item.id === pId || item.productId === pId) && item.unit === unitToUse);
      let next;
      if (idx > -1) {
        next = [...prev];
        next[idx].quantity += quantity;
      } else {
        next = [...prev, { ...product, id: pId, productId: pId, quantity, unit: unitToUse, addedAt: new Date().toISOString() }];
      }
      saveCart(next, userId);
      return next;
    });
    notify.success(`${product.name || 'Produk'} added to cart`);
  }, [userId, saveCart]);

  const updateQuantity = useCallback((id: string, qty: number, unit?: string) => {
    setCart(prev => {
      const next = prev.map(item => 
        (item.id === id || item.productId === id) && (!unit || item.unit === unit)
          ? { ...item, quantity: Math.max(1, qty) }
          : item
      );
      saveCart(next, userId);
      return next;
    });
  }, [userId, saveCart]);

  const removeFromCart = useCallback((id: string, unit?: string) => {
    setCart(prev => {
      const next = prev.filter(item => !((item.id === id || item.productId === id) && (!unit || item.unit === unit)));
      saveCart(next, userId);
      return next;
    });
  }, [userId, saveCart]);

  const clearCart = useCallback(() => {
    saveCart([], userId);
  }, [userId, saveCart]);

  const itemCount = cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const subtotal = cart.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0);

  return (
    <CartContext.Provider value={{ cart, itemCount, subtotal, addToCart, updateQuantity, removeFromCart, clearCart, loading }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
}

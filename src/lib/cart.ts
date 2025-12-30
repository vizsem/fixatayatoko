// src/lib/cart.ts
import { auth } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product } from '@/lib/products';

// Tipe CartItem
export type CartItem = Product & { quantity: number };

// === Fungsi Keranjang ===
export const getCart = async (): Promise<CartItem[]> => {
  const user = auth.currentUser;
  
  if (user) {
    // Ambil dari Firestore
    const cartRef = doc(db, 'carts', user.uid);
    const cartSnap = await getDoc(cartRef);
    
    if (cartSnap.exists()) {
      return cartSnap.data().items || [];
    }
    return [];
  } else {
    // Ambil dari localStorage
    const saved = localStorage.getItem('atayatoko-cart');
    return saved ? JSON.parse(saved) : [];
  }
};

export const addToCart = async (product: Product, quantity: number = 1) => {
  const user = auth.currentUser;
  const newItem = { ...product, quantity };

  if (user) {
    const cartRef = doc(db, 'carts', user.uid);
    const cartSnap = await getDoc(cartRef);
    
    if (cartSnap.exists()) {
      const items = cartSnap.data().items || [];
      const existingIndex = items.findIndex((item: CartItem) => item.id === product.id);
      
      if (existingIndex >= 0) {
        items[existingIndex].quantity += quantity;
        await updateDoc(cartRef, { items });
      } else {
        await updateDoc(cartRef, { items: [...items, newItem] });
      }
    } else {
      await setDoc(cartRef, { items: [newItem] });
    }
  } else {
    // Fallback ke localStorage
    const savedCart = localStorage.getItem('atayatoko-cart');
    let cart: CartItem[] = savedCart ? JSON.parse(savedCart) : [];
    
    const existingIndex = cart.findIndex(item => item.id === product.id);
    if (existingIndex >= 0) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push(newItem);
    }
    
    localStorage.setItem('atayatoko-cart', JSON.stringify(cart));
  }
};

export const updateCartItem = async (productId: number, newQuantity: number) => {
  if (newQuantity <= 0) {
    await removeFromCart(productId);
    return;
  }

  const user = auth.currentUser;
  
  if (user) {
    const cartRef = doc(db, 'carts', user.uid);
    const cartSnap = await getDoc(cartRef);
    
    if (cartSnap.exists()) {
      const items = cartSnap.data().items.map((item: CartItem) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
      await updateDoc(cartRef, { items });
    }
  } else {
    const savedCart = localStorage.getItem('atayatoko-cart');
    if (savedCart) {
      const cart = JSON.parse(savedCart);
      const updated = cart.map((item: CartItem) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
      localStorage.setItem('atayatoko-cart', JSON.stringify(updated));
    }
  }
};

export const removeFromCart = async (productId: number) => {
  const user = auth.currentUser;
  
  if (user) {
    const cartRef = doc(db, 'carts', user.uid);
    const cartSnap = await getDoc(cartRef);
    
    if (cartSnap.exists()) {
      const items = cartSnap.data().items.filter((item: CartItem) => item.id !== productId);
      await updateDoc(cartRef, { items });
    }
  } else {
    const savedCart = localStorage.getItem('atayatoko-cart');
    if (savedCart) {
      const cart = JSON.parse(savedCart);
      const updated = cart.filter((item: CartItem) => item.id !== productId);
      localStorage.setItem('atayatoko-cart', JSON.stringify(updated));
    }
  }
};

export const clearCart = async () => {
  const user = auth.currentUser;
  
  if (user) {
    const cartRef = doc(db, 'carts', user.uid);
    await setDoc(cartRef, { items: [] });
  } else {
    localStorage.removeItem('atayatoko-cart');
  }
};

// === Fungsi Wishlist ===
export const getWishlist = async (): Promise<number[]> => {
  const user = auth.currentUser;
  
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data().wishlist || [];
    }
    return [];
  } else {
    const saved = localStorage.getItem('atayatoko-wishlist');
    return saved ? JSON.parse(saved) : [];
  }
};

export const addToWishlist = async (productId: number) => {
  const user = auth.currentUser;
  
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      wishlist: arrayUnion(productId)
    });
  } else {
    const wishlist = await getWishlist();
    if (!wishlist.includes(productId)) {
      wishlist.push(productId);
      localStorage.setItem('atayatoko-wishlist', JSON.stringify(wishlist));
    }
  }
};

export const removeFromWishlist = async (productId: number) => {
  const user = auth.currentUser;
  
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const wishlist = userSnap.data().wishlist || [];
      const updated = wishlist.filter(id => id !== productId);
      
      await updateDoc(userRef, { wishlist: updated });
    }
  } else {
    const wishlist = await getWishlist();
    const updated = wishlist.filter(id => id !== productId);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(updated));
  }
};

export const syncLocalToCloud = async () => {
  // Hanya dipanggil saat user login
  const user = auth.currentUser;
  if (!user) return;

  // Sinkronisasi keranjang
  const localCart = localStorage.getItem('atayatoko-cart');
  if (localCart) {
    const cartItems = JSON.parse(localCart);
    if (cartItems.length > 0) {
      const cartRef = doc(db, 'carts', user.uid);
      await setDoc(cartRef, { items: cartItems });
    }
    localStorage.removeItem('atayatoko-cart');
  }

  // Sinkronisasi wishlist
  const localWishlist = localStorage.getItem('atayatoko-wishlist');
  if (localWishlist) {
    const wishlist = JSON.parse(localWishlist);
    if (wishlist.length > 0) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { wishlist });
    }
    localStorage.removeItem('atayatoko-wishlist');
  }
};
// src/lib/wishlist.ts

export const getWishlist = (): string[] => {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('atayatoko-wishlist');
    return data ? JSON.parse(data) : [];
  }
  return [];
};

export const addToWishlist = (productId: string): void => {
  if (typeof window !== 'undefined') {
    const wishlist = getWishlist();
    if (!wishlist.includes(productId)) {
      localStorage.setItem('atayatoko-wishlist', JSON.stringify([...wishlist, productId]));
    }
  }
};

export const removeFromWishlist = (productId: string): void => {
  if (typeof window !== 'undefined') {
    const wishlist = getWishlist().filter(id => id !== productId);
    localStorage.setItem('atayatoko-wishlist', JSON.stringify(wishlist));
  }
};

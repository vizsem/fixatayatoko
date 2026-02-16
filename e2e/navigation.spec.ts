import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to different categories', async ({ page }) => {
    await page.goto('/');
    
    // Check if category links are present
    const categoryLinks = page.getByRole('link', { name: /kategori|category/i });
    await expect(categoryLinks.first()).toBeVisible();
    
    // Click on first category
    await categoryLinks.first().click();
    
    // Should be on category page
    await expect(page).toHaveURL(/.*kategori|category.*/i);
    await expect(page.getByRole('heading', { name: /produk|products/i })).toBeVisible();
  });

  test('should search for products', async ({ page }) => {
    await page.goto('/');
    
    // Find search input
    const searchInput = page.getByRole('textbox', { name: /cari|search/i });
    await expect(searchInput).toBeVisible();
    
    // Perform search
    await searchInput.fill('test');
    await searchInput.press('Enter');
    
    // Should be on search results page
    await expect(page).toHaveURL(/.*cari|search.*/i);
    await expect(page.getByText(/hasil pencarian|search results/i)).toBeVisible();
  });

  test('should view product details', async ({ page }) => {
    await page.goto('/');
    
    // Find a product card
    const productCard = page.getByRole('link', { name: /beli|buy|detail/i }).first();
    await expect(productCard).toBeVisible();
    
    // Click on product
    await productCard.click();
    
    // Should be on product detail page
    await expect(page).toHaveURL(/.*produk|product.*/i);
    await expect(page.getByRole('heading', { name: /detail|product/i })).toBeVisible();
    
    // Check product information
    await expect(page.getByText(/harga|price/i)).toBeVisible();
    await expect(page.getByText(/deskripsi|description/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /tambah|add to cart/i })).toBeVisible();
  });
});
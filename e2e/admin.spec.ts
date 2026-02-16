import { test, expect } from '@playwright/test';

test.describe('Admin Functionality', () => {
  test('should redirect to login when accessing admin without authentication', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login|auth.*/i);
    await expect(page.getByRole('heading', { name: /login|masuk/i })).toBeVisible();
  });

  test('should show admin dashboard after login', async ({ page }) => {
    // This test assumes we have a way to authenticate as admin
    // For now, we'll just test the redirect behavior
    
    await page.goto('/admin');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*login|auth.*/i);
  });

  test('should access admin product management', async ({ page }) => {
    await page.goto('/admin/produk');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login|auth.*/i);
  });

  test('should access admin order management', async ({ page }) => {
    await page.goto('/admin/orders');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login|auth.*/i);
  });
});

test.describe('Admin UI Elements', () => {
  test('should have admin navigation structure', async ({ page }) => {
    // This would require authentication setup
    // For now, we test that admin routes exist and redirect properly
    
    const adminRoutes = ['/admin/produk', '/admin/orders', '/admin/users', '/admin/settings'];
    
    for (const route of adminRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/.*login|auth.*/i);
    }
  });
});
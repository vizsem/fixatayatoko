import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display homepage with title', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/Toko/);
    
    // Check if navigation is visible
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // Check if products section is present
    await expect(page.getByText(/produk|products/i)).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    
    // Find and click login link
    const loginLink = page.getByRole('link', { name: /login|masuk/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    
    // Verify we're on login page
    await expect(page).toHaveURL(/.*login|auth.*/i);
    await expect(page.getByRole('heading', { name: /login|masuk/i })).toBeVisible();
    
    // Check if login form is present
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /login|masuk/i })).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Fill invalid credentials
    await page.getByRole('textbox', { name: /email/i }).fill('invalid@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    await page.getByRole('button', { name: /login|masuk/i }).click();
    
    // Should show error message
    await expect(page.getByText(/error|invalid|gagal/i)).toBeVisible({ timeout: 5000 });
  });
});
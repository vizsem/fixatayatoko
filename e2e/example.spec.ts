import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Toko/);
});

test('can navigate to login', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // Find the login link and click it
  await page.getByRole('link', { name: /login|masuk/i }).click();

  // Expects page to have a heading with the name of Login.
  await expect(page.getByRole('heading', { name: /login|masuk/i })).toBeVisible();
});

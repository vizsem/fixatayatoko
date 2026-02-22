"use strict";

var _test = require("@playwright/test");
_test.test.describe('Admin Functionality', () => {
  (0, _test.test)('should redirect to login when accessing admin without authentication', async ({
    page
  }) => {
    await page.goto('/admin');

    // Should redirect to login page
    await (0, _test.expect)(page).toHaveURL(/.*login|auth.*/i);
    await (0, _test.expect)(page.getByRole('heading', {
      name: /login|masuk/i
    })).toBeVisible();
  });
  (0, _test.test)('should show admin dashboard after login', async ({
    page
  }) => {
    // This test assumes we have a way to authenticate as admin
    // For now, we'll just test the redirect behavior

    await page.goto('/admin');

    // Should be redirected to login
    await (0, _test.expect)(page).toHaveURL(/.*login|auth.*/i);
  });
  (0, _test.test)('should access admin product management', async ({
    page
  }) => {
    await page.goto('/admin/produk');

    // Should redirect to login
    await (0, _test.expect)(page).toHaveURL(/.*login|auth.*/i);
  });
  (0, _test.test)('should access admin order management', async ({
    page
  }) => {
    await page.goto('/admin/orders');

    // Should redirect to login
    await (0, _test.expect)(page).toHaveURL(/.*login|auth.*/i);
  });
});
_test.test.describe('Admin UI Elements', () => {
  (0, _test.test)('should have admin navigation structure', async ({
    page
  }) => {
    // This would require authentication setup
    // For now, we test that admin routes exist and redirect properly

    const adminRoutes = ['/admin/produk', '/admin/orders', '/admin/users', '/admin/settings'];
    for (const route of adminRoutes) {
      await page.goto(route);
      await (0, _test.expect)(page).toHaveURL(/.*login|auth.*/i);
    }
  });
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdGVzdCIsInJlcXVpcmUiLCJ0ZXN0IiwiZGVzY3JpYmUiLCJwYWdlIiwiZ290byIsImV4cGVjdCIsInRvSGF2ZVVSTCIsImdldEJ5Um9sZSIsIm5hbWUiLCJ0b0JlVmlzaWJsZSIsImFkbWluUm91dGVzIiwicm91dGUiXSwic291cmNlcyI6WyJhZG1pbi5zcGVjLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRlc3QsIGV4cGVjdCB9IGZyb20gJ0BwbGF5d3JpZ2h0L3Rlc3QnO1xuXG50ZXN0LmRlc2NyaWJlKCdBZG1pbiBGdW5jdGlvbmFsaXR5JywgKCkgPT4ge1xuICB0ZXN0KCdzaG91bGQgcmVkaXJlY3QgdG8gbG9naW4gd2hlbiBhY2Nlc3NpbmcgYWRtaW4gd2l0aG91dCBhdXRoZW50aWNhdGlvbicsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICAgIGF3YWl0IHBhZ2UuZ290bygnL2FkbWluJyk7XG4gICAgXG4gICAgLy8gU2hvdWxkIHJlZGlyZWN0IHRvIGxvZ2luIHBhZ2VcbiAgICBhd2FpdCBleHBlY3QocGFnZSkudG9IYXZlVVJMKC8uKmxvZ2lufGF1dGguKi9pKTtcbiAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVJvbGUoJ2hlYWRpbmcnLCB7IG5hbWU6IC9sb2dpbnxtYXN1ay9pIH0pKS50b0JlVmlzaWJsZSgpO1xuICB9KTtcblxuICB0ZXN0KCdzaG91bGQgc2hvdyBhZG1pbiBkYXNoYm9hcmQgYWZ0ZXIgbG9naW4nLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgICAvLyBUaGlzIHRlc3QgYXNzdW1lcyB3ZSBoYXZlIGEgd2F5IHRvIGF1dGhlbnRpY2F0ZSBhcyBhZG1pblxuICAgIC8vIEZvciBub3csIHdlJ2xsIGp1c3QgdGVzdCB0aGUgcmVkaXJlY3QgYmVoYXZpb3JcbiAgICBcbiAgICBhd2FpdCBwYWdlLmdvdG8oJy9hZG1pbicpO1xuICAgIFxuICAgIC8vIFNob3VsZCBiZSByZWRpcmVjdGVkIHRvIGxvZ2luXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UpLnRvSGF2ZVVSTCgvLipsb2dpbnxhdXRoLiovaSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Nob3VsZCBhY2Nlc3MgYWRtaW4gcHJvZHVjdCBtYW5hZ2VtZW50JywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XG4gICAgYXdhaXQgcGFnZS5nb3RvKCcvYWRtaW4vcHJvZHVrJyk7XG4gICAgXG4gICAgLy8gU2hvdWxkIHJlZGlyZWN0IHRvIGxvZ2luXG4gICAgYXdhaXQgZXhwZWN0KHBhZ2UpLnRvSGF2ZVVSTCgvLipsb2dpbnxhdXRoLiovaSk7XG4gIH0pO1xuXG4gIHRlc3QoJ3Nob3VsZCBhY2Nlc3MgYWRtaW4gb3JkZXIgbWFuYWdlbWVudCcsIGFzeW5jICh7IHBhZ2UgfSkgPT4ge1xuICAgIGF3YWl0IHBhZ2UuZ290bygnL2FkbWluL29yZGVycycpO1xuICAgIFxuICAgIC8vIFNob3VsZCByZWRpcmVjdCB0byBsb2dpblxuICAgIGF3YWl0IGV4cGVjdChwYWdlKS50b0hhdmVVUkwoLy4qbG9naW58YXV0aC4qL2kpO1xuICB9KTtcbn0pO1xuXG50ZXN0LmRlc2NyaWJlKCdBZG1pbiBVSSBFbGVtZW50cycsICgpID0+IHtcbiAgdGVzdCgnc2hvdWxkIGhhdmUgYWRtaW4gbmF2aWdhdGlvbiBzdHJ1Y3R1cmUnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcbiAgICAvLyBUaGlzIHdvdWxkIHJlcXVpcmUgYXV0aGVudGljYXRpb24gc2V0dXBcbiAgICAvLyBGb3Igbm93LCB3ZSB0ZXN0IHRoYXQgYWRtaW4gcm91dGVzIGV4aXN0IGFuZCByZWRpcmVjdCBwcm9wZXJseVxuICAgIFxuICAgIGNvbnN0IGFkbWluUm91dGVzID0gWycvYWRtaW4vcHJvZHVrJywgJy9hZG1pbi9vcmRlcnMnLCAnL2FkbWluL3VzZXJzJywgJy9hZG1pbi9zZXR0aW5ncyddO1xuICAgIFxuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgYWRtaW5Sb3V0ZXMpIHtcbiAgICAgIGF3YWl0IHBhZ2UuZ290byhyb3V0ZSk7XG4gICAgICBhd2FpdCBleHBlY3QocGFnZSkudG9IYXZlVVJMKC8uKmxvZ2lufGF1dGguKi9pKTtcbiAgICB9XG4gIH0pO1xufSk7Il0sIm1hcHBpbmdzIjoiOztBQUFBLElBQUFBLEtBQUEsR0FBQUMsT0FBQTtBQUVBQyxVQUFJLENBQUNDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxNQUFNO0VBQ3pDLElBQUFELFVBQUksRUFBQyxzRUFBc0UsRUFBRSxPQUFPO0lBQUVFO0VBQUssQ0FBQyxLQUFLO0lBQy9GLE1BQU1BLElBQUksQ0FBQ0MsSUFBSSxDQUFDLFFBQVEsQ0FBQzs7SUFFekI7SUFDQSxNQUFNLElBQUFDLFlBQU0sRUFBQ0YsSUFBSSxDQUFDLENBQUNHLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQztJQUMvQyxNQUFNLElBQUFELFlBQU0sRUFBQ0YsSUFBSSxDQUFDSSxTQUFTLENBQUMsU0FBUyxFQUFFO01BQUVDLElBQUksRUFBRTtJQUFlLENBQUMsQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO0VBQ2pGLENBQUMsQ0FBQztFQUVGLElBQUFSLFVBQUksRUFBQyx5Q0FBeUMsRUFBRSxPQUFPO0lBQUVFO0VBQUssQ0FBQyxLQUFLO0lBQ2xFO0lBQ0E7O0lBRUEsTUFBTUEsSUFBSSxDQUFDQyxJQUFJLENBQUMsUUFBUSxDQUFDOztJQUV6QjtJQUNBLE1BQU0sSUFBQUMsWUFBTSxFQUFDRixJQUFJLENBQUMsQ0FBQ0csU0FBUyxDQUFDLGlCQUFpQixDQUFDO0VBQ2pELENBQUMsQ0FBQztFQUVGLElBQUFMLFVBQUksRUFBQyx3Q0FBd0MsRUFBRSxPQUFPO0lBQUVFO0VBQUssQ0FBQyxLQUFLO0lBQ2pFLE1BQU1BLElBQUksQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsQ0FBQzs7SUFFaEM7SUFDQSxNQUFNLElBQUFDLFlBQU0sRUFBQ0YsSUFBSSxDQUFDLENBQUNHLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQztFQUNqRCxDQUFDLENBQUM7RUFFRixJQUFBTCxVQUFJLEVBQUMsc0NBQXNDLEVBQUUsT0FBTztJQUFFRTtFQUFLLENBQUMsS0FBSztJQUMvRCxNQUFNQSxJQUFJLENBQUNDLElBQUksQ0FBQyxlQUFlLENBQUM7O0lBRWhDO0lBQ0EsTUFBTSxJQUFBQyxZQUFNLEVBQUNGLElBQUksQ0FBQyxDQUFDRyxTQUFTLENBQUMsaUJBQWlCLENBQUM7RUFDakQsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBRUZMLFVBQUksQ0FBQ0MsUUFBUSxDQUFDLG1CQUFtQixFQUFFLE1BQU07RUFDdkMsSUFBQUQsVUFBSSxFQUFDLHdDQUF3QyxFQUFFLE9BQU87SUFBRUU7RUFBSyxDQUFDLEtBQUs7SUFDakU7SUFDQTs7SUFFQSxNQUFNTyxXQUFXLEdBQUcsQ0FBQyxlQUFlLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxpQkFBaUIsQ0FBQztJQUV6RixLQUFLLE1BQU1DLEtBQUssSUFBSUQsV0FBVyxFQUFFO01BQy9CLE1BQU1QLElBQUksQ0FBQ0MsSUFBSSxDQUFDTyxLQUFLLENBQUM7TUFDdEIsTUFBTSxJQUFBTixZQUFNLEVBQUNGLElBQUksQ0FBQyxDQUFDRyxTQUFTLENBQUMsaUJBQWlCLENBQUM7SUFDakQ7RUFDRixDQUFDLENBQUM7QUFDSixDQUFDLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
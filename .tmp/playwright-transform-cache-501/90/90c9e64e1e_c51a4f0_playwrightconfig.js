"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _test = require("@playwright/test");
var _default = exports.default = (0, _test.defineConfig)({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000'
  }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdGVzdCIsInJlcXVpcmUiLCJfZGVmYXVsdCIsImV4cG9ydHMiLCJkZWZhdWx0IiwiZGVmaW5lQ29uZmlnIiwidGVzdERpciIsInVzZSIsImJhc2VVUkwiXSwic291cmNlcyI6WyJwbGF5d3JpZ2h0LmNvbmZpZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICdAcGxheXdyaWdodC90ZXN0JztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGVzdERpcjogJy4vZTJlJyxcbiAgdXNlOiB7XG4gICAgYmFzZVVSTDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCdcbiAgfVxufSk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQUFBLEtBQUEsR0FBQUMsT0FBQTtBQUFnRCxJQUFBQyxRQUFBLEdBQUFDLE9BQUEsQ0FBQUMsT0FBQSxHQUVqQyxJQUFBQyxrQkFBWSxFQUFDO0VBQzFCQyxPQUFPLEVBQUUsT0FBTztFQUNoQkMsR0FBRyxFQUFFO0lBQ0hDLE9BQU8sRUFBRTtFQUNYO0FBQ0YsQ0FBQyxDQUFDIiwiaWdub3JlTGlzdCI6W119
import {registerRoute as workbox_routing_registerRoute} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-routing/registerRoute.mjs';
import {NetworkFirst as workbox_strategies_NetworkFirst} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-strategies/NetworkFirst.mjs';
import {ExpirationPlugin as workbox_expiration_ExpirationPlugin} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-expiration/ExpirationPlugin.mjs';
import {CacheFirst as workbox_strategies_CacheFirst} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-strategies/CacheFirst.mjs';
import {StaleWhileRevalidate as workbox_strategies_StaleWhileRevalidate} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-strategies/StaleWhileRevalidate.mjs';
import {RangeRequestsPlugin as workbox_range_requests_RangeRequestsPlugin} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-range-requests/RangeRequestsPlugin.mjs';
import {clientsClaim as workbox_core_clientsClaim} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-core/clientsClaim.mjs';
import {precacheAndRoute as workbox_precaching_precacheAndRoute} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-precaching/precacheAndRoute.mjs';
import {cleanupOutdatedCaches as workbox_precaching_cleanupOutdatedCaches} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-precaching/cleanupOutdatedCaches.mjs';/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */


importScripts(
  
);







self.skipWaiting();

workbox_core_clientsClaim();


/**
 * The precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
workbox_precaching_precacheAndRoute([
  {
    "url": "/_next/static/X4CPQ6LMtrbWuECXVlyr0/_buildManifest.js",
    "revision": "d39f112e55ffb974c7798baf4cdb9a13"
  },
  {
    "url": "/_next/static/X4CPQ6LMtrbWuECXVlyr0/_ssgManifest.js",
    "revision": "b6652df95db52feb4daf4eca35380933"
  },
  {
    "url": "/_next/static/chunks/1942-64991859b24d1a7c.js",
    "revision": "64991859b24d1a7c"
  },
  {
    "url": "/_next/static/chunks/2170a4aa-de32b52f7130ef20.js",
    "revision": "de32b52f7130ef20"
  },
  {
    "url": "/_next/static/chunks/282-ed373c3f33e8f5fd.js",
    "revision": "ed373c3f33e8f5fd"
  },
  {
    "url": "/_next/static/chunks/2922-523f4116b866e5b8.js",
    "revision": "523f4116b866e5b8"
  },
  {
    "url": "/_next/static/chunks/403-6f3cd93b486de6b9.js",
    "revision": "6f3cd93b486de6b9"
  },
  {
    "url": "/_next/static/chunks/4254-ab2c31f1df3639fe.js",
    "revision": "ab2c31f1df3639fe"
  },
  {
    "url": "/_next/static/chunks/4401-773ce3e914413d9f.js",
    "revision": "773ce3e914413d9f"
  },
  {
    "url": "/_next/static/chunks/4925-de196c5d3195e6de.js",
    "revision": "de196c5d3195e6de"
  },
  {
    "url": "/_next/static/chunks/4bd1b696-1400c1b9494d4acb.js",
    "revision": "1400c1b9494d4acb"
  },
  {
    "url": "/_next/static/chunks/5222-5941f27e3cb1ba8f.js",
    "revision": "5941f27e3cb1ba8f"
  },
  {
    "url": "/_next/static/chunks/5772-a4d889fed696a312.js",
    "revision": "a4d889fed696a312"
  },
  {
    "url": "/_next/static/chunks/5b86099a-79f08ea871825a39.js",
    "revision": "79f08ea871825a39"
  },
  {
    "url": "/_next/static/chunks/601-6791fd27fa2c8c1b.js",
    "revision": "6791fd27fa2c8c1b"
  },
  {
    "url": "/_next/static/chunks/6048.8b4bae47f6d7fb4d.js",
    "revision": "8b4bae47f6d7fb4d"
  },
  {
    "url": "/_next/static/chunks/6271-6c1bb68b9345bdb1.js",
    "revision": "6c1bb68b9345bdb1"
  },
  {
    "url": "/_next/static/chunks/6574-199d502d186e5a39.js",
    "revision": "199d502d186e5a39"
  },
  {
    "url": "/_next/static/chunks/6614-e818b83102edd609.js",
    "revision": "e818b83102edd609"
  },
  {
    "url": "/_next/static/chunks/6675-df16f5196ff2e085.js",
    "revision": "df16f5196ff2e085"
  },
  {
    "url": "/_next/static/chunks/6724-6672e1bb5f948dcb.js",
    "revision": "6672e1bb5f948dcb"
  },
  {
    "url": "/_next/static/chunks/7015-5ad14989c405bb2c.js",
    "revision": "5ad14989c405bb2c"
  },
  {
    "url": "/_next/static/chunks/7508b87c-81738115f3b5222c.js",
    "revision": "81738115f3b5222c"
  },
  {
    "url": "/_next/static/chunks/7854-f79bfc582e23ace7.js",
    "revision": "f79bfc582e23ace7"
  },
  {
    "url": "/_next/static/chunks/8130-4bea48a1050527d3.js",
    "revision": "4bea48a1050527d3"
  },
  {
    "url": "/_next/static/chunks/8436.cab94b59cca0a8ff.js",
    "revision": "cab94b59cca0a8ff"
  },
  {
    "url": "/_next/static/chunks/8500-27e7d9770d119ae1.js",
    "revision": "27e7d9770d119ae1"
  },
  {
    "url": "/_next/static/chunks/8896-34b3b9a905b7eb65.js",
    "revision": "34b3b9a905b7eb65"
  },
  {
    "url": "/_next/static/chunks/8928-c2768d2c8a13e787.js",
    "revision": "c2768d2c8a13e787"
  },
  {
    "url": "/_next/static/chunks/8950-76e0cbb29fd5191c.js",
    "revision": "76e0cbb29fd5191c"
  },
  {
    "url": "/_next/static/chunks/9082-78c38b029c727867.js",
    "revision": "78c38b029c727867"
  },
  {
    "url": "/_next/static/chunks/app/_global-error/page-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/app/_not-found/page-11394499ddb9126a.js",
    "revision": "11394499ddb9126a"
  },
  {
    "url": "/_next/static/chunks/app/admin/customers/edit/%5Bid%5D/page-0c3668f57e63d489.js",
    "revision": "0c3668f57e63d489"
  },
  {
    "url": "/_next/static/chunks/app/admin/customers/page-08e442ecebf30f45.js",
    "revision": "08e442ecebf30f45"
  },
  {
    "url": "/_next/static/chunks/app/admin/employees/page-2ed6d1ba1d6629cd.js",
    "revision": "2ed6d1ba1d6629cd"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/history/page-60f93fb4ab72e99f.js",
    "revision": "60f93fb4ab72e99f"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/logs/page-9175a5653104ed54.js",
    "revision": "9175a5653104ed54"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/opname/page-9df9f8e009807188.js",
    "revision": "9df9f8e009807188"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/page-6f2356b045860c97.js",
    "revision": "6f2356b045860c97"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/stock-in/page-a4a9b84d88d69043.js",
    "revision": "a4a9b84d88d69043"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/stock-out/page-c8884991992b7adf.js",
    "revision": "c8884991992b7adf"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/transfer/page-95f5068e1cbd5bf7.js",
    "revision": "95f5068e1cbd5bf7"
  },
  {
    "url": "/_next/static/chunks/app/admin/kategori/page-b629a76ace4b0d91.js",
    "revision": "b629a76ace4b0d91"
  },
  {
    "url": "/_next/static/chunks/app/admin/layout-74ad4915d3c4f124.js",
    "revision": "74ad4915d3c4f124"
  },
  {
    "url": "/_next/static/chunks/app/admin/orders/%5Bid%5D/page-dab80502299eab85.js",
    "revision": "dab80502299eab85"
  },
  {
    "url": "/_next/static/chunks/app/admin/orders/page-81f3ec7b3138b345.js",
    "revision": "81f3ec7b3138b345"
  },
  {
    "url": "/_next/static/chunks/app/admin/orders/print/%5Bid%5D/page-810084e9b3f3e6d5.js",
    "revision": "810084e9b3f3e6d5"
  },
  {
    "url": "/_next/static/chunks/app/admin/page-d46c858e9b13c7b9.js",
    "revision": "d46c858e9b13c7b9"
  },
  {
    "url": "/_next/static/chunks/app/admin/points/page-dba6d9aeaabb227e.js",
    "revision": "dba6d9aeaabb227e"
  },
  {
    "url": "/_next/static/chunks/app/admin/products/add/page-de7ce70ad964f477.js",
    "revision": "de7ce70ad964f477"
  },
  {
    "url": "/_next/static/chunks/app/admin/products/edit/%5Bid%5D/page-8ef93f364f316e9d.js",
    "revision": "8ef93f364f316e9d"
  },
  {
    "url": "/_next/static/chunks/app/admin/products/page-05daff232b886b8b.js",
    "revision": "05daff232b886b8b"
  },
  {
    "url": "/_next/static/chunks/app/admin/promotions/add/page-36a273752ee44789.js",
    "revision": "36a273752ee44789"
  },
  {
    "url": "/_next/static/chunks/app/admin/promotions/edit/%5Bid%5D/page-2ec7ccd5624d9f3b.js",
    "revision": "2ec7ccd5624d9f3b"
  },
  {
    "url": "/_next/static/chunks/app/admin/promotions/page-1273f06295c2a012.js",
    "revision": "1273f06295c2a012"
  },
  {
    "url": "/_next/static/chunks/app/admin/purchases/%5Bid%5D/page-e5911f139b8b9e73.js",
    "revision": "e5911f139b8b9e73"
  },
  {
    "url": "/_next/static/chunks/app/admin/purchases/add/page-4667ffceb7a8a252.js",
    "revision": "4667ffceb7a8a252"
  },
  {
    "url": "/_next/static/chunks/app/admin/purchases/page-76db6e25a8abe7ab.js",
    "revision": "76db6e25a8abe7ab"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/customers/page-c6cee23e3895c849.js",
    "revision": "c6cee23e3895c849"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/finance/page-f60d4a4260ee12c2.js",
    "revision": "f60d4a4260ee12c2"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/inventory/page-279e08717568e97f.js",
    "revision": "279e08717568e97f"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/operations/page-245b9a5f7c690420.js",
    "revision": "245b9a5f7c690420"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/page-68ec545d0d8221ea.js",
    "revision": "68ec545d0d8221ea"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/promotions/page-1e7df70c2894cc24.js",
    "revision": "1e7df70c2894cc24"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/sales/page-3b56e07b07d3e25f.js",
    "revision": "3b56e07b07d3e25f"
  },
  {
    "url": "/_next/static/chunks/app/admin/settings/page-cbf4ee225334fa17.js",
    "revision": "cbf4ee225334fa17"
  },
  {
    "url": "/_next/static/chunks/app/admin/settings/points/page-1e79cb07946f30bb.js",
    "revision": "1e79cb07946f30bb"
  },
  {
    "url": "/_next/static/chunks/app/admin/suppliers/page-57c6738fdbfbde47.js",
    "revision": "57c6738fdbfbde47"
  },
  {
    "url": "/_next/static/chunks/app/admin/users/page-e96d5a1fbc60ad2f.js",
    "revision": "e96d5a1fbc60ad2f"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/add/page-80934e011717ffce.js",
    "revision": "80934e011717ffce"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/edit/%5Bid%5D/page-f44cabbcbce86f11.js",
    "revision": "f44cabbcbce86f11"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/mutasi/%5Bid%5D/page-3cf95a927af99671.js",
    "revision": "3cf95a927af99671"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/page-a345420fae1a9696.js",
    "revision": "a345420fae1a9696"
  },
  {
    "url": "/_next/static/chunks/app/api/admin/logout/route-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/app/api/orders/create/route-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/app/cart/page-3f4fbcd638b027f3.js",
    "revision": "3f4fbcd638b027f3"
  },
  {
    "url": "/_next/static/chunks/app/cashier/orders/%5Bid%5D/page-f878b076c8ef62f3.js",
    "revision": "f878b076c8ef62f3"
  },
  {
    "url": "/_next/static/chunks/app/cashier/page-e8757926a791df3b.js",
    "revision": "e8757926a791df3b"
  },
  {
    "url": "/_next/static/chunks/app/kategori/%5Bslug%5D/page-df12fdb0db5df04e.js",
    "revision": "df12fdb0db5df04e"
  },
  {
    "url": "/_next/static/chunks/app/kontak/page-48cc93f4cb54b7c9.js",
    "revision": "48cc93f4cb54b7c9"
  },
  {
    "url": "/_next/static/chunks/app/layout-3c4ad06c96ecfa8c.js",
    "revision": "3c4ad06c96ecfa8c"
  },
  {
    "url": "/_next/static/chunks/app/orders/%5Bid%5D/page-84e1e2106311715b.js",
    "revision": "84e1e2106311715b"
  },
  {
    "url": "/_next/static/chunks/app/orders/page-32eeb0a5f09effb6.js",
    "revision": "32eeb0a5f09effb6"
  },
  {
    "url": "/_next/static/chunks/app/page-ab51fe41261a29d7.js",
    "revision": "ab51fe41261a29d7"
  },
  {
    "url": "/_next/static/chunks/app/products/edit/%5Bid%5D/page-f79963a351a62e4c.js",
    "revision": "f79963a351a62e4c"
  },
  {
    "url": "/_next/static/chunks/app/produk/%5Bid%5D/page-64f3a0b1a53fa5a4.js",
    "revision": "64f3a0b1a53fa5a4"
  },
  {
    "url": "/_next/static/chunks/app/profil/edit/page-50625c94cb370748.js",
    "revision": "50625c94cb370748"
  },
  {
    "url": "/_next/static/chunks/app/profil/login/page-deea2ef617440c76.js",
    "revision": "deea2ef617440c76"
  },
  {
    "url": "/_next/static/chunks/app/profil/logout/page-81a95589ea31a1f1.js",
    "revision": "81a95589ea31a1f1"
  },
  {
    "url": "/_next/static/chunks/app/profil/page-75314c4530242903.js",
    "revision": "75314c4530242903"
  },
  {
    "url": "/_next/static/chunks/app/profil/register/page-eee4e5a07269d825.js",
    "revision": "eee4e5a07269d825"
  },
  {
    "url": "/_next/static/chunks/app/promo/page-e72cab00108d4544.js",
    "revision": "e72cab00108d4544"
  },
  {
    "url": "/_next/static/chunks/app/purchases/add/page-6e570f0afc317fa1.js",
    "revision": "6e570f0afc317fa1"
  },
  {
    "url": "/_next/static/chunks/app/reports/customers/page-4b924fbae52e03a3.js",
    "revision": "4b924fbae52e03a3"
  },
  {
    "url": "/_next/static/chunks/app/reports/finance/page-087d65aeb86fc2ce.js",
    "revision": "087d65aeb86fc2ce"
  },
  {
    "url": "/_next/static/chunks/app/reports/inventory/page-b6e918862b67f6b6.js",
    "revision": "b6e918862b67f6b6"
  },
  {
    "url": "/_next/static/chunks/app/reports/operations/page-ee185009fce0270e.js",
    "revision": "ee185009fce0270e"
  },
  {
    "url": "/_next/static/chunks/app/reports/page-2f0fe659efc1f98f.js",
    "revision": "2f0fe659efc1f98f"
  },
  {
    "url": "/_next/static/chunks/app/reports/promotions/page-0e594ecd6ae898ec.js",
    "revision": "0e594ecd6ae898ec"
  },
  {
    "url": "/_next/static/chunks/app/reports/sales/page-3a9e83f01f8fd32f.js",
    "revision": "3a9e83f01f8fd32f"
  },
  {
    "url": "/_next/static/chunks/app/semua-kategori/page-7249f7aacc71976b.js",
    "revision": "7249f7aacc71976b"
  },
  {
    "url": "/_next/static/chunks/app/success/page-6d2b45b3c1d3ec0d.js",
    "revision": "6d2b45b3c1d3ec0d"
  },
  {
    "url": "/_next/static/chunks/app/tentang/page-8dcbf4283935ced4.js",
    "revision": "8dcbf4283935ced4"
  },
  {
    "url": "/_next/static/chunks/app/transaksi/%5Bid%5D/page-222539d76bfb01c5.js",
    "revision": "222539d76bfb01c5"
  },
  {
    "url": "/_next/static/chunks/app/vouchers/page-3e16802f0dbf4471.js",
    "revision": "3e16802f0dbf4471"
  },
  {
    "url": "/_next/static/chunks/app/wishlist/page-59c31f3227c875ae.js",
    "revision": "59c31f3227c875ae"
  },
  {
    "url": "/_next/static/chunks/framework-d7945a8ad0653f37.js",
    "revision": "d7945a8ad0653f37"
  },
  {
    "url": "/_next/static/chunks/main-3ad1d4f89a2550c3.js",
    "revision": "3ad1d4f89a2550c3"
  },
  {
    "url": "/_next/static/chunks/main-app-afdb0fcdce1133cd.js",
    "revision": "afdb0fcdce1133cd"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/app-error-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/forbidden-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/global-error-5abb717c3ac8f984.js",
    "revision": "5abb717c3ac8f984"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/not-found-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/unauthorized-903f33edaf52a2d0.js",
    "revision": "903f33edaf52a2d0"
  },
  {
    "url": "/_next/static/chunks/polyfills-42372ed130431b0a.js",
    "revision": "846118c33b2c0e922d7b3a7676f81f6f"
  },
  {
    "url": "/_next/static/chunks/webpack-0782c4b8ba14819c.js",
    "revision": "0782c4b8ba14819c"
  },
  {
    "url": "/_next/static/css/65c82115cf08e104.css",
    "revision": "65c82115cf08e104"
  },
  {
    "url": "/apple-touch-icon.png",
    "revision": "c76ba3017262ecdfaa4ac1e260a7bbf3"
  },
  {
    "url": "/favicon-96x96.png",
    "revision": "316023ee91d6b0089a7830662822d4e2"
  },
  {
    "url": "/favicon.ico",
    "revision": "93b3421fdd77abed375578405d22e98c"
  },
  {
    "url": "/favicon.svg",
    "revision": "18ad7cab42f537b7ba886aa5dfb76bb6"
  },
  {
    "url": "/file.svg",
    "revision": "d09f95206c3fa0bb9bd9fefabfd0ea71"
  },
  {
    "url": "/firebase-messaging-sw.js",
    "revision": "a38219387f7ce7a212a611377c5468f3"
  },
  {
    "url": "/globe.svg",
    "revision": "2aaafa6a49b6563925fe440891e32717"
  },
  {
    "url": "/logo-atayatoko.png",
    "revision": "7b27abb4a9b292a46d3254994a85d393"
  },
  {
    "url": "/next.svg",
    "revision": "8e061864f388b47f33a1c3780831193e"
  },
  {
    "url": "/site.webmanifest",
    "revision": "1d7895c5240d21af2469e53bf935b3e2"
  },
  {
    "url": "/vercel.svg",
    "revision": "c0af2f507b369b085b35ef4bbe3bcf1e"
  },
  {
    "url": "/web-app-manifest-192x192.png",
    "revision": "3a2f103415a8d30614ba36ae9f6b3811"
  },
  {
    "url": "/web-app-manifest-512x512.png",
    "revision": "7b27abb4a9b292a46d3254994a85d393"
  },
  {
    "url": "/window.svg",
    "revision": "a2760511c65806022ad20adf74370ff3"
  },
  {
    "url": "/xlsx.full.min.js",
    "revision": "50d3c495c9358a6196878296d2644eab"
  }
], {
  "ignoreURLParametersMatching": [/^utm_/, /^fbclid$/]
});
workbox_precaching_cleanupOutdatedCaches();



workbox_routing_registerRoute("/", new workbox_strategies_NetworkFirst({ "cacheName":"start-url", plugins: [{ cacheWillUpdate: async ({ response: e })=>e && "opaqueredirect" === e.type ? new Response(e.body, { status: 200, statusText: "OK", headers: e.headers }) : e }] }), 'GET');
workbox_routing_registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i, new workbox_strategies_CacheFirst({ "cacheName":"google-fonts-webfonts", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536000 })] }), 'GET');
workbox_routing_registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"google-fonts-stylesheets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"static-font-assets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"static-image-assets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 2592000 })] }), 'GET');
workbox_routing_registerRoute(/\/_next\/static.+\.js$/i, new workbox_strategies_CacheFirst({ "cacheName":"next-static-js-assets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\/_next\/image\?url=.+$/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"next-image", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:mp3|wav|ogg)$/i, new workbox_strategies_CacheFirst({ "cacheName":"static-audio-assets", plugins: [new workbox_range_requests_RangeRequestsPlugin(), new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:mp4|webm)$/i, new workbox_strategies_CacheFirst({ "cacheName":"static-video-assets", plugins: [new workbox_range_requests_RangeRequestsPlugin(), new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:js)$/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"static-js-assets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:css|less)$/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"static-style-assets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\/_next\/data\/.+\/.+\.json$/i, new workbox_strategies_StaleWhileRevalidate({ "cacheName":"next-data", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(/\.(?:json|xml|csv)$/i, new workbox_strategies_NetworkFirst({ "cacheName":"static-data-assets", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(({ sameOrigin: e, url: { pathname: t } })=>!(!e || t.startsWith("/api/auth/callback")) && !!t.startsWith("/api/"), new workbox_strategies_NetworkFirst({ "cacheName":"apis","networkTimeoutSeconds":10, plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(({ request: e, url: { pathname: t }, sameOrigin: a })=>"1" === e.headers.get("RSC") && "1" === e.headers.get("Next-Router-Prefetch") && a && !t.startsWith("/api/"), new workbox_strategies_NetworkFirst({ "cacheName":"pages-rsc-prefetch", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(({ request: e, url: { pathname: t }, sameOrigin: a })=>"1" === e.headers.get("RSC") && a && !t.startsWith("/api/"), new workbox_strategies_NetworkFirst({ "cacheName":"pages-rsc", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(({ url: { pathname: e }, sameOrigin: t })=>t && !e.startsWith("/api/"), new workbox_strategies_NetworkFirst({ "cacheName":"pages", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(({ sameOrigin: e })=>!e, new workbox_strategies_NetworkFirst({ "cacheName":"cross-origin","networkTimeoutSeconds":10, plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 })] }), 'GET');





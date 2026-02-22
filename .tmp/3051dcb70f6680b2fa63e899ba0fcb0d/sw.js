import {registerRoute as workbox_routing_registerRoute} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-routing/registerRoute.mjs';
import {NetworkFirst as workbox_strategies_NetworkFirst} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-strategies/NetworkFirst.mjs';
import {CacheableResponsePlugin as workbox_cacheable_response_CacheableResponsePlugin} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-cacheable-response/CacheableResponsePlugin.mjs';
import {ExpirationPlugin as workbox_expiration_ExpirationPlugin} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-expiration/ExpirationPlugin.mjs';
import {CacheFirst as workbox_strategies_CacheFirst} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-strategies/CacheFirst.mjs';
import {StaleWhileRevalidate as workbox_strategies_StaleWhileRevalidate} from '/Users/hadzikoh/marketpleace-new/node_modules/workbox-strategies/StaleWhileRevalidate.mjs';
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
    "url": "/_next/static/chunks/1243-55a7f5b636fa70d3.js",
    "revision": "55a7f5b636fa70d3"
  },
  {
    "url": "/_next/static/chunks/1512-2f081d50effb73db.js",
    "revision": "2f081d50effb73db"
  },
  {
    "url": "/_next/static/chunks/1718-4e1c98e9eb5a6642.js",
    "revision": "4e1c98e9eb5a6642"
  },
  {
    "url": "/_next/static/chunks/1969-267166c5b4bdb091.js",
    "revision": "267166c5b4bdb091"
  },
  {
    "url": "/_next/static/chunks/2170a4aa-d28be3e2076c7818.js",
    "revision": "d28be3e2076c7818"
  },
  {
    "url": "/_next/static/chunks/230-b45c1b1bc7fbaa7d.js",
    "revision": "b45c1b1bc7fbaa7d"
  },
  {
    "url": "/_next/static/chunks/282-e941071f56c8aaa0.js",
    "revision": "e941071f56c8aaa0"
  },
  {
    "url": "/_next/static/chunks/3592-3ee800df6ec03435.js",
    "revision": "3ee800df6ec03435"
  },
  {
    "url": "/_next/static/chunks/3726-c4cb2b2b0eecc3a8.js",
    "revision": "c4cb2b2b0eecc3a8"
  },
  {
    "url": "/_next/static/chunks/4254-e01ad530542bc54a.js",
    "revision": "e01ad530542bc54a"
  },
  {
    "url": "/_next/static/chunks/4401-38d3f9cf1ed2f816.js",
    "revision": "38d3f9cf1ed2f816"
  },
  {
    "url": "/_next/static/chunks/489-1671fb5528452c4e.js",
    "revision": "1671fb5528452c4e"
  },
  {
    "url": "/_next/static/chunks/4969-6fc98ed1e714d360.js",
    "revision": "6fc98ed1e714d360"
  },
  {
    "url": "/_next/static/chunks/4bd1b696-e5d7c65570c947b7.js",
    "revision": "e5d7c65570c947b7"
  },
  {
    "url": "/_next/static/chunks/5237-2de772c8c709b07b.js",
    "revision": "2de772c8c709b07b"
  },
  {
    "url": "/_next/static/chunks/557-deeb02455be6bb77.js",
    "revision": "deeb02455be6bb77"
  },
  {
    "url": "/_next/static/chunks/5772-9a8e97a228f89e51.js",
    "revision": "9a8e97a228f89e51"
  },
  {
    "url": "/_next/static/chunks/5b86099a-e62d415d3b8bd353.js",
    "revision": "e62d415d3b8bd353"
  },
  {
    "url": "/_next/static/chunks/6048.8b4bae47f6d7fb4d.js",
    "revision": "8b4bae47f6d7fb4d"
  },
  {
    "url": "/_next/static/chunks/6583-fc3e03da803437bb.js",
    "revision": "fc3e03da803437bb"
  },
  {
    "url": "/_next/static/chunks/7508b87c-5e0c31e6a4656b7c.js",
    "revision": "5e0c31e6a4656b7c"
  },
  {
    "url": "/_next/static/chunks/8001-ae3829788462dcd2.js",
    "revision": "ae3829788462dcd2"
  },
  {
    "url": "/_next/static/chunks/8145-e113a53a99cb454d.js",
    "revision": "e113a53a99cb454d"
  },
  {
    "url": "/_next/static/chunks/8436.cab94b59cca0a8ff.js",
    "revision": "cab94b59cca0a8ff"
  },
  {
    "url": "/_next/static/chunks/8500-98e13bcce54aa7a0.js",
    "revision": "98e13bcce54aa7a0"
  },
  {
    "url": "/_next/static/chunks/8634.efc1ac8af56bf0f4.js",
    "revision": "efc1ac8af56bf0f4"
  },
  {
    "url": "/_next/static/chunks/8928-5b4c8886e6a629a6.js",
    "revision": "5b4c8886e6a629a6"
  },
  {
    "url": "/_next/static/chunks/8937-c5e681a1509550b7.js",
    "revision": "c5e681a1509550b7"
  },
  {
    "url": "/_next/static/chunks/9145-8e8664958534d893.js",
    "revision": "8e8664958534d893"
  },
  {
    "url": "/_next/static/chunks/9149-36b4e3ba074fab6e.js",
    "revision": "36b4e3ba074fab6e"
  },
  {
    "url": "/_next/static/chunks/app/_global-error/page-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/app/_not-found/page-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/app/admin/customers/edit/%5Bid%5D/page-898a283722fa0ae4.js",
    "revision": "898a283722fa0ae4"
  },
  {
    "url": "/_next/static/chunks/app/admin/customers/page-4201058dd255c538.js",
    "revision": "4201058dd255c538"
  },
  {
    "url": "/_next/static/chunks/app/admin/employees/page-879a1ea57133a26d.js",
    "revision": "879a1ea57133a26d"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/history/page-678efc0d837cdc6d.js",
    "revision": "678efc0d837cdc6d"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/logs/page-77e3bf994f34b3e0.js",
    "revision": "77e3bf994f34b3e0"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/opname/page-567e237c0c5c440f.js",
    "revision": "567e237c0c5c440f"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/page-14c66045cfc1c4a4.js",
    "revision": "14c66045cfc1c4a4"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/stock-in/page-faa724ed2dd9ce46.js",
    "revision": "faa724ed2dd9ce46"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/stock-out/page-e3ea3c54aa44d9b2.js",
    "revision": "e3ea3c54aa44d9b2"
  },
  {
    "url": "/_next/static/chunks/app/admin/inventory/transfer/page-227706289b970159.js",
    "revision": "227706289b970159"
  },
  {
    "url": "/_next/static/chunks/app/admin/kategori/page-102641c3341eb685.js",
    "revision": "102641c3341eb685"
  },
  {
    "url": "/_next/static/chunks/app/admin/layout-2725104fe77c45c6.js",
    "revision": "2725104fe77c45c6"
  },
  {
    "url": "/_next/static/chunks/app/admin/orders/%5Bid%5D/page-5db41953adf991f2.js",
    "revision": "5db41953adf991f2"
  },
  {
    "url": "/_next/static/chunks/app/admin/orders/page-522fbcc5599369de.js",
    "revision": "522fbcc5599369de"
  },
  {
    "url": "/_next/static/chunks/app/admin/orders/print/%5Bid%5D/page-0ee718f9ae0a26f4.js",
    "revision": "0ee718f9ae0a26f4"
  },
  {
    "url": "/_next/static/chunks/app/admin/page-106b7a11dfdd279d.js",
    "revision": "106b7a11dfdd279d"
  },
  {
    "url": "/_next/static/chunks/app/admin/points/page-fc9062192b9712d9.js",
    "revision": "fc9062192b9712d9"
  },
  {
    "url": "/_next/static/chunks/app/admin/products/add/page-12299dd88516b74e.js",
    "revision": "12299dd88516b74e"
  },
  {
    "url": "/_next/static/chunks/app/admin/products/edit/%5Bid%5D/page-8ab980d67a64bd0f.js",
    "revision": "8ab980d67a64bd0f"
  },
  {
    "url": "/_next/static/chunks/app/admin/products/page-5b396163027032d6.js",
    "revision": "5b396163027032d6"
  },
  {
    "url": "/_next/static/chunks/app/admin/promotions/add/page-adb79a59faed410f.js",
    "revision": "adb79a59faed410f"
  },
  {
    "url": "/_next/static/chunks/app/admin/promotions/edit/%5Bid%5D/page-e8adc0186d9c7fc8.js",
    "revision": "e8adc0186d9c7fc8"
  },
  {
    "url": "/_next/static/chunks/app/admin/promotions/page-15203e001de2adc3.js",
    "revision": "15203e001de2adc3"
  },
  {
    "url": "/_next/static/chunks/app/admin/purchases/%5Bid%5D/page-4b2e643335191374.js",
    "revision": "4b2e643335191374"
  },
  {
    "url": "/_next/static/chunks/app/admin/purchases/add/page-8b647cab5e91f4e0.js",
    "revision": "8b647cab5e91f4e0"
  },
  {
    "url": "/_next/static/chunks/app/admin/purchases/page-3da8e11e15c20006.js",
    "revision": "3da8e11e15c20006"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/customers/page-45689b4aaba3433c.js",
    "revision": "45689b4aaba3433c"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/finance/page-31d64a095cbbdec0.js",
    "revision": "31d64a095cbbdec0"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/inventory/page-b9d4c5670e80e120.js",
    "revision": "b9d4c5670e80e120"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/operations/page-2e680c682646457c.js",
    "revision": "2e680c682646457c"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/page-9219a87fbfcac2cf.js",
    "revision": "9219a87fbfcac2cf"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/promotions/page-aa6b8c1efe1f3e89.js",
    "revision": "aa6b8c1efe1f3e89"
  },
  {
    "url": "/_next/static/chunks/app/admin/reports/sales/page-94f661a8b2b6bb7b.js",
    "revision": "94f661a8b2b6bb7b"
  },
  {
    "url": "/_next/static/chunks/app/admin/settings/page-d984d9a7e3f2cf38.js",
    "revision": "d984d9a7e3f2cf38"
  },
  {
    "url": "/_next/static/chunks/app/admin/settings/points/page-d9100143d5867096.js",
    "revision": "d9100143d5867096"
  },
  {
    "url": "/_next/static/chunks/app/admin/suppliers/edit/%5Bid%5D/page-1e75d6e2f382a961.js",
    "revision": "1e75d6e2f382a961"
  },
  {
    "url": "/_next/static/chunks/app/admin/suppliers/page-27c16c8f67d9aa95.js",
    "revision": "27c16c8f67d9aa95"
  },
  {
    "url": "/_next/static/chunks/app/admin/users/page-20f0c57d5eb47421.js",
    "revision": "20f0c57d5eb47421"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/add/page-b4fc2c7ddc8aa479.js",
    "revision": "b4fc2c7ddc8aa479"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/edit/%5Bid%5D/page-ee0bc57b98c504a0.js",
    "revision": "ee0bc57b98c504a0"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/mutasi/%5Bid%5D/page-fced86d57af29154.js",
    "revision": "fced86d57af29154"
  },
  {
    "url": "/_next/static/chunks/app/admin/warehouses/page-138b2ba621ff6d08.js",
    "revision": "138b2ba621ff6d08"
  },
  {
    "url": "/_next/static/chunks/app/api/admin/logout/route-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/app/api/orders/create/route-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/app/cart/page-9e5569f999a362d0.js",
    "revision": "9e5569f999a362d0"
  },
  {
    "url": "/_next/static/chunks/app/cashier/orders/%5Bid%5D/page-979a3a51e98e7bce.js",
    "revision": "979a3a51e98e7bce"
  },
  {
    "url": "/_next/static/chunks/app/cashier/page-9d941ce13d01d506.js",
    "revision": "9d941ce13d01d506"
  },
  {
    "url": "/_next/static/chunks/app/error-579d01848d2f01d7.js",
    "revision": "579d01848d2f01d7"
  },
  {
    "url": "/_next/static/chunks/app/kategori/%5Bslug%5D/page-0dec3a84bd78f545.js",
    "revision": "0dec3a84bd78f545"
  },
  {
    "url": "/_next/static/chunks/app/kontak/page-48cc93f4cb54b7c9.js",
    "revision": "48cc93f4cb54b7c9"
  },
  {
    "url": "/_next/static/chunks/app/layout-88c4dbf1ea60cf55.js",
    "revision": "88c4dbf1ea60cf55"
  },
  {
    "url": "/_next/static/chunks/app/not-found-210dcda2bf5b512f.js",
    "revision": "210dcda2bf5b512f"
  },
  {
    "url": "/_next/static/chunks/app/orders/%5Bid%5D/page-3f48d85a3c6a332d.js",
    "revision": "3f48d85a3c6a332d"
  },
  {
    "url": "/_next/static/chunks/app/orders/page-ae7c8bcfb86dd294.js",
    "revision": "ae7c8bcfb86dd294"
  },
  {
    "url": "/_next/static/chunks/app/page-9ee743ce6da6f898.js",
    "revision": "9ee743ce6da6f898"
  },
  {
    "url": "/_next/static/chunks/app/products/edit/%5Bid%5D/page-a8b892f9b04d0fad.js",
    "revision": "a8b892f9b04d0fad"
  },
  {
    "url": "/_next/static/chunks/app/produk/%5Bid%5D/page-c6875d40e1b6606f.js",
    "revision": "c6875d40e1b6606f"
  },
  {
    "url": "/_next/static/chunks/app/profil/edit/page-791a1ba1f92c5914.js",
    "revision": "791a1ba1f92c5914"
  },
  {
    "url": "/_next/static/chunks/app/profil/login/page-4dd5da9574260834.js",
    "revision": "4dd5da9574260834"
  },
  {
    "url": "/_next/static/chunks/app/profil/logout/page-fd11d06e7eb17eaf.js",
    "revision": "fd11d06e7eb17eaf"
  },
  {
    "url": "/_next/static/chunks/app/profil/page-640c7ad7d0bca30a.js",
    "revision": "640c7ad7d0bca30a"
  },
  {
    "url": "/_next/static/chunks/app/profil/register/page-6f78b3c9122fc030.js",
    "revision": "6f78b3c9122fc030"
  },
  {
    "url": "/_next/static/chunks/app/promo/page-e72cab00108d4544.js",
    "revision": "e72cab00108d4544"
  },
  {
    "url": "/_next/static/chunks/app/purchases/add/page-c6512cf81afa9950.js",
    "revision": "c6512cf81afa9950"
  },
  {
    "url": "/_next/static/chunks/app/reports/customers/page-9c3691d56b24367c.js",
    "revision": "9c3691d56b24367c"
  },
  {
    "url": "/_next/static/chunks/app/reports/finance/page-18d995c3b5893af6.js",
    "revision": "18d995c3b5893af6"
  },
  {
    "url": "/_next/static/chunks/app/reports/inventory/page-398a5ddbfa20d9e7.js",
    "revision": "398a5ddbfa20d9e7"
  },
  {
    "url": "/_next/static/chunks/app/reports/operations/page-f853b980e68aed88.js",
    "revision": "f853b980e68aed88"
  },
  {
    "url": "/_next/static/chunks/app/reports/page-ea42f1c939903b16.js",
    "revision": "ea42f1c939903b16"
  },
  {
    "url": "/_next/static/chunks/app/reports/promotions/page-ce85d192bab3ac22.js",
    "revision": "ce85d192bab3ac22"
  },
  {
    "url": "/_next/static/chunks/app/reports/sales/page-4eb175b12bfb284d.js",
    "revision": "4eb175b12bfb284d"
  },
  {
    "url": "/_next/static/chunks/app/semua-kategori/page-5a26971869ab861f.js",
    "revision": "5a26971869ab861f"
  },
  {
    "url": "/_next/static/chunks/app/success/page-f52abd5d2ff30d51.js",
    "revision": "f52abd5d2ff30d51"
  },
  {
    "url": "/_next/static/chunks/app/tentang/page-8dcbf4283935ced4.js",
    "revision": "8dcbf4283935ced4"
  },
  {
    "url": "/_next/static/chunks/app/transaksi/%5Bid%5D/page-aa6c2ec29bcab6cb.js",
    "revision": "aa6c2ec29bcab6cb"
  },
  {
    "url": "/_next/static/chunks/app/vouchers/page-274e506c3f3d4cd4.js",
    "revision": "274e506c3f3d4cd4"
  },
  {
    "url": "/_next/static/chunks/app/wishlist/page-5419eb0be69f1d18.js",
    "revision": "5419eb0be69f1d18"
  },
  {
    "url": "/_next/static/chunks/framework-0675a4b5b92df616.js",
    "revision": "0675a4b5b92df616"
  },
  {
    "url": "/_next/static/chunks/main-app-afdb0fcdce1133cd.js",
    "revision": "afdb0fcdce1133cd"
  },
  {
    "url": "/_next/static/chunks/main-b5eb073e8c3e82dd.js",
    "revision": "b5eb073e8c3e82dd"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/app-error-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/forbidden-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/global-error-5abb717c3ac8f984.js",
    "revision": "5abb717c3ac8f984"
  },
  {
    "url": "/_next/static/chunks/next/dist/client/components/builtin/unauthorized-78bda4bc880085b9.js",
    "revision": "78bda4bc880085b9"
  },
  {
    "url": "/_next/static/chunks/polyfills-42372ed130431b0a.js",
    "revision": "846118c33b2c0e922d7b3a7676f81f6f"
  },
  {
    "url": "/_next/static/chunks/webpack-6834881dd838b9d2.js",
    "revision": "6834881dd838b9d2"
  },
  {
    "url": "/_next/static/css/34bc501e543eefa5.css",
    "revision": "34bc501e543eefa5"
  },
  {
    "url": "/_next/static/o0D1rs5Ahv7KFTQ3NQ_9N/_buildManifest.js",
    "revision": "13038e3f818390c1ef482fce6adc4ed0"
  },
  {
    "url": "/_next/static/o0D1rs5Ahv7KFTQ3NQ_9N/_ssgManifest.js",
    "revision": "b6652df95db52feb4daf4eca35380933"
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
    "revision": "3db6b1a6eb27421786645952b9cad096"
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
    "url": "/robots.txt",
    "revision": "736b27d81c95f76b5f2ebc9c7fd554a4"
  },
  {
    "url": "/site.webmanifest",
    "revision": "1d7895c5240d21af2469e53bf935b3e2"
  },
  {
    "url": "/sitemap.xml",
    "revision": "b699d828711d2ea64f95f4c5543e497c"
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
workbox_routing_registerRoute(/^https:\/\/firestore\.googleapis\.com\/.*/i, new workbox_strategies_NetworkFirst({ "cacheName":"firestore-api","networkTimeoutSeconds":10, plugins: [new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] }), new workbox_expiration_ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })] }), 'GET');
workbox_routing_registerRoute(/^https:\/\/firebasestorage\.googleapis\.com\/.*/i, new workbox_strategies_CacheFirst({ "cacheName":"firebase-storage", plugins: [new workbox_cacheable_response_CacheableResponsePlugin({ statuses: [ 0, 200 ] }), new workbox_expiration_ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })] }), 'GET');
workbox_routing_registerRoute(({ request })=>request.destination === "image", new workbox_strategies_CacheFirst({ "cacheName":"images", plugins: [new workbox_expiration_ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 604800 })] }), 'GET');
workbox_routing_registerRoute(({ request })=>request.destination === "script" || request.destination === "style", new workbox_strategies_StaleWhileRevalidate({ "cacheName":"assets", plugins: [] }), 'GET');





import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const collections = [
  "products",
  "orders",
  "customers",
  "credit",
  "promotions",
];

for (const col of collections) {
  await db.collection(col).doc("__init__").set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(col);
}

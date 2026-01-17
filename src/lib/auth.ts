import { getAuth, GoogleAuthProvider, signInWithRedirect } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const auth = getAuth();
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  await signInWithRedirect(auth, provider);
};

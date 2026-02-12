import { getAuth, GoogleAuthProvider, signInWithRedirect } from "firebase/auth";
// No unused Firestore imports needed here


const auth = getAuth();
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  await signInWithRedirect(auth, provider);
};

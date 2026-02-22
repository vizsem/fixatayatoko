import { getAuth, GoogleAuthProvider, signInWithRedirect } from "firebase/auth";

const auth = getAuth();
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  await signInWithRedirect(auth, provider);
};

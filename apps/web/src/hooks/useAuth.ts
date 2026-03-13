import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase.js";

export function useAuth() {
  const [user, setUser] = useState(auth.currentUser);
  const [token, setToken] = useState<{ admin?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const r = await u.getIdTokenResult();
        setToken(r.claims as { admin?: boolean });
      } else setToken(null);
      setLoading(false);
    });
  }, []);

  return {
    user,
    loading,
    isAdmin: token?.admin === true,
    signIn: (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass),
  };
}

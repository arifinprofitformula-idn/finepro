// src/context/AuthContext.jsx
// State auth global: user, status loading awal, dan aksi login/signup/logout.
// Token JWT sendiri tetap disimpan di localStorage lewat src/api/apiClient.js
// (tidak diduplikasi di sini) — context ini hanya menyimpan data user.

import { createContext, useState, useEffect, useCallback } from "react";
import { signUp, signIn, signOut, getSession } from "../api/auth.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (!cancelled) {
        setUser(session ? session.user : null);
        setInitializing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await signIn(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (email, password) => {
    const data = await signUp(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  // Dipakai setelah upload avatar / update profil — sinkronkan tanpa re-fetch penuh
  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

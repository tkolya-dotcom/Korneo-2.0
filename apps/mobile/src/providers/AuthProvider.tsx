import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, usersApi, supabase } from '@/src/lib/supabase';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'worker';
  is_online?: boolean;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  session: any;
  signIn: (email: string, password: string) => Promise;
  signOut: () => Promise;
  login: (email: string, password: string) => Promise;
  register: (email: string, password: string, name: string, role: string) => Promise;
  logout: () => Promise;
  isManager: boolean;
  isWorker: boolean;
};

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      if (s?.access_token) {
        try {
          const data = await authApi.getMe();
          setUser(data.user);
        } catch { setUser(null); }
      }
      if (mounted) setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (!s?.access_token) { setUser(null); return; }
      try {
        const data = await authApi.getMe();
        setUser(data.user);
      } catch { setUser(null); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setUser(data.user);
    return data;
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const data = await authApi.register(email, password, name, role);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try { await usersApi.markOffline(); } catch {}
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, session,
      signIn: async (email: string, password: string) => { await login(email, password); },
      signOut: logout,
      login, register, logout,
      isManager: user?.role === 'manager',
      isWorker: user?.role === 'worker',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

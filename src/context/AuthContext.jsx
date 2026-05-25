import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = async (userId) => {
    setIsLoading(true);
    if (!userId) {
      setSubscriptionData(null);
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, status, current_period_end')
      .eq('tenant_id', userId)
      .maybeSingle();
      
    if (!error && data) {
      setSubscriptionData(data);
    } else {
      setSubscriptionData(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // Obtener la sesión actual al cargar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.user) {
        fetchSubscription(session.user.id).then(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.user) {
        fetchSubscription(session.user.id);
      } else {
        setSubscriptionData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const register = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, subscriptionData, isLoading, login, register, logout, fetchSubscription }}>
      {children}
    </AuthContext.Provider>
  );
};

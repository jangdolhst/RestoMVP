import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  shouldClearSubscriptionForAuthEvent,
  shouldRefetchSubscriptionForAuthEvent,
} from '../lib/authEvents';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const getPasswordRecoveryUrl = () => `${window.location.origin}/reset-password`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserIdRef = useRef(null);

  const fetchSubscription = async (userId, { showGlobalLoading = false } = {}) => {
    if (showGlobalLoading) setIsLoading(true);

    if (!userId) {
      setSubscriptionData(null);
      if (showGlobalLoading) setIsLoading(false);
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

    if (showGlobalLoading) setIsLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    // Obtener la sesion actual al cargar. Esta es la unica carga global inicial.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      const initialUser = session?.user || null;
      setSession(session);
      setUser(initialUser);
      currentUserIdRef.current = initialUser?.id || null;

      if (initialUser?.id) {
        await fetchSubscription(initialUser.id);
      } else {
        setSubscriptionData(null);
      }

      if (isMounted) setIsLoading(false);
    });

    // Supabase puede emitir TOKEN_REFRESHED al volver al foco. No debe desmontar la ruta.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUser = nextSession?.user || null;
      const nextUserId = nextUser?.id || null;
      const currentUserId = currentUserIdRef.current;

      setSession(nextSession);
      setUser(nextUser);

      if (shouldClearSubscriptionForAuthEvent({ event, nextUserId })) {
        currentUserIdRef.current = null;
        setSubscriptionData(null);
        setIsLoading(false);
        return;
      }

      if (shouldRefetchSubscriptionForAuthEvent({ event, currentUserId, nextUserId })) {
        currentUserIdRef.current = nextUserId;
        fetchSubscription(nextUserId);
        return;
      }

      currentUserIdRef.current = nextUserId;
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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

  const requestPasswordReset = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRecoveryUrl(),
    });
    if (error) throw error;
    return data;
  };

  const updatePassword = async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, subscriptionData, isLoading, login, register, requestPasswordReset, updatePassword, logout, fetchSubscription }}>
      {children}
    </AuthContext.Provider>
  );
};

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionStatus {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  isInTrial: boolean;
  trialEnd: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionStatus;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
    isInTrial: false,
    trialEnd: null,
  });

  const checkSubscription = async (currentSession: Session | null) => {
    if (!currentSession) {
      setSubscription({
        subscribed: false,
        productId: null,
        subscriptionEnd: null,
        isInTrial: false,
        trialEnd: null,
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      setSubscription({
        subscribed: data.subscribed || false,
        productId: data.product_id || null,
        subscriptionEnd: data.subscription_end || null,
        isInTrial: data.is_in_trial || false,
        trialEnd: data.trial_end || null,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const refreshSubscription = async () => {
    await checkSubscription(session);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Check subscription when auth state changes
        setTimeout(() => {
          checkSubscription(currentSession);
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      // Check subscription on initial load
      setTimeout(() => {
        checkSubscription(currentSession);
      }, 0);
    });

    return () => authSubscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, subscription, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
};

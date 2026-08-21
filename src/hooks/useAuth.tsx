import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ensureProfile } from '@/lib/auth';

interface Profile {
  id: string;
  nome: string | null;
  role: string;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, loading: true });

  useEffect(() => {
    let mounted = true;

    async function loadProfile(session: Session | null) {
      if (!session) {
        if (mounted) setState({ session: null, profile: null, loading: false });
        return;
      }
      try {
        await ensureProfile(session);
        const { data } = await supabase.from('hbs_profiles').select('id, nome, role').eq('id', session.user.id).maybeSingle();
        if (mounted) setState({ session, profile: data ?? null, loading: false });
      } catch {
        if (mounted) setState({ session, profile: null, loading: false });
      }
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

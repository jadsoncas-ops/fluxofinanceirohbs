import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function checkInviteCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('hbs_check_invite_code', { code });
  if (error) throw error;
  return !!data;
}

export async function signUp(email: string, password: string, nome: string, inviteCode: string) {
  const valido = await checkInviteCode(inviteCode);
  if (!valido) throw new Error('Código de convite inválido.');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome } },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Cria a linha em `profiles` no primeiro login, se ainda não existir. */
export async function ensureProfile(session: Session) {
  const { data: existing } = await supabase
    .from('hbs_profiles')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();
  if (existing) return;

  const nome = (session.user.user_metadata?.nome as string) || session.user.email || 'Usuário';
  await supabase.from('hbs_profiles').insert({ id: session.user.id, nome, role: 'admin' });
}

/** Quantidade de contas já cadastradas — usado só pra esconder o link de cadastro. */
export async function countProfiles(): Promise<number> {
  const { data, error } = await supabase.rpc('hbs_profiles_count');
  if (error) throw error;
  return data ?? 0;
}

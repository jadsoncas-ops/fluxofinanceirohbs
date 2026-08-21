import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { signUp, countProfiles } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import hbsLogo from '@/assets/hbs-logo.png';

export default function CadastroPage() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fechado, setFechado] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    countProfiles().then(n => setFechado(n >= 2)).catch(() => setFechado(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email.trim(), password, nome.trim(), inviteCode.trim());
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success('Conta criada.');
        navigate('/', { replace: true });
      } else {
        toast.success('Conta criada. Verifique seu e-mail para confirmar antes de entrar.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg === 'Código de convite inválido.' ? msg : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src={hbsLogo} alt="HBS Engenharia" className="h-9 w-auto dark:invert dark:brightness-200" />
          <span className="text-[10.5px] tracking-[.16em] text-mute-2 font-mono-hbs uppercase">Portal de Gestão</span>
        </div>

        {fechado ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
            <p className="text-[13px] font-medium">Cadastro encerrado.</p>
            <p className="text-xs text-mute-2">As contas do escritório já foram criadas. Se precisar de acesso, fale com um administrador.</p>
            <Link to="/login" className="inline-block text-xs text-accent hover:text-accent-hover font-medium mt-2">Ir para o login</Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Seu nome</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label>Código de convite</Label>
                <Input value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Criando…' : 'Criar conta'}</Button>
            </form>
            <p className="text-center text-xs text-mute-2 mt-4">
              Já tem conta? <Link to="/login" className="text-accent hover:text-accent-hover font-medium">Entrar</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

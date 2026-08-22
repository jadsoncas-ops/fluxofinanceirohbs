import { useEffect, useState, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { signIn, countProfiles } from '@/lib/auth';
import { toast } from 'sonner';
import hbsLogo from '@/assets/hbs-logo.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/';

  useEffect(() => {
    countProfiles().then(n => setShowCadastro(n < 2)).catch(() => setShowCadastro(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg.includes('Invalid login credentials') ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="min-h-full flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-8">
            <img src={hbsLogo} alt="HBS Engenharia" className="h-9 w-auto dark:invert dark:brightness-200" />
            <span className="text-[10.5px] tracking-[.16em] text-mute-2 font-mono-hbs uppercase">Portal de Gestão</span>
          </div>
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</Button>
          </form>
          {showCadastro && (
            <p className="text-center text-xs text-mute-2 mt-4">
              Primeiro acesso? <Link to="/cadastro" className="text-accent hover:text-accent-hover font-medium">Criar conta</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

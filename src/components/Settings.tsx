import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { exportBackup, importBackup } from '@/lib/storage';
import { toast } from 'sonner';
import { Download, Upload, Shield, Moon, Smartphone } from 'lucide-react';

interface Props {
  onDataChange: () => void;
}

export function Settings({ onDataChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  function handleExport() {
    try {
      const data = exportBackup();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_financeiro_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso.');
    } catch {
      toast.error('Erro ao exportar backup.');
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackup(reader.result as string);
        toast.success('Backup importado com sucesso.');
        onDataChange();
      } catch {
        toast.error('Ficheiro inválido. Verifique o formato JSON.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Dark Mode */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="dark-mode" className="text-sm font-semibold cursor-pointer">Modo Escuro</Label>
            </div>
            <Switch id="dark-mode" checked={dark} onCheckedChange={setDark} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Segurança dos Dados</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Os seus dados são armazenados localmente no navegador. Faça backups regulares para segurança.
          </p>

          <div className="grid gap-3">
            <Button onClick={handleExport} variant="outline" className="justify-start gap-2 h-11">
              <Download className="w-4 h-4" />
              <div className="text-left">
                <p className="text-xs font-medium">Exportar Backup JSON</p>
                <p className="text-[10px] text-muted-foreground">Descarregar todos os dados</p>
              </div>
            </Button>

            <Button variant="outline" className="justify-start gap-2 h-11" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" />
              <div className="text-left">
                <p className="text-xs font-medium">Importar Backup JSON</p>
                <p className="text-[10px] text-muted-foreground">Restaurar dados a partir de ficheiro</p>
              </div>
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Informações</h3>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Armazenamento: Local (navegador)</p>
            <p>Versão: 1.0.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { exportBackup, importBackup } from '@/lib/storage';
import { toast } from 'sonner';
import { Download, Upload, Database, Shield } from 'lucide-react';

interface Props {
  onDataChange: () => void;
}

export function Settings({ onDataChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = exportBackup();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_financeiro_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportado com sucesso.');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackup(reader.result as string);
        toast.success('Backup importado. Recarregando...');
        setTimeout(() => window.location.reload(), 1000);
      } catch {
        toast.error('Ficheiro inválido. Verifique o formato JSON.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Segurança dos Dados</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Os seus dados são armazenados localmente no navegador. Faça backups regulares para garantir a segurança das suas informações financeiras.
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
            <Database className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Informações</h3>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Armazenamento: localStorage do navegador</p>
            <p>Limite: ~5MB de dados</p>
            <p>Versão: 1.0.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

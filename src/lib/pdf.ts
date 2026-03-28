import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from './types';

export function generateMonthlyReport(transactions: Transaction[], month: number, year: number): void {
  const doc = new jsPDF();
  const monthName = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Foca no que foi concluído (Dinheiro real)
  const realizedTxs = transactions.filter(t => t.status === 'Concluído');
  
  const entradas = realizedTxs.filter(t => t.tipo === 'Entrada').sort((a,b) => a.data.localeCompare(b.data));
  const saidasTotal = realizedTxs.filter(t => t.tipo === 'Saída').sort((a,b) => a.data.localeCompare(b.data));

  // Divisão de saídas
  const repassesList = saidasTotal.filter(t => t.isRepasse);
  const despesasList = saidasTotal.filter(t => !t.isRepasse);

  const totalEntradas = entradas.reduce((s, t) => s + t.valor, 0);
  const totalRepasses = repassesList.reduce((s, t) => s + t.valor, 0);
  const totalDespesas = despesasList.reduce((s, t) => s + t.valor, 0);
  const totalSaidasCompilado = totalRepasses + totalDespesas;
  
  const lucroLiquido = totalEntradas - totalSaidasCompilado;
  const isPositivo = lucroLiquido >= 0;

  // Proporções
  const repassePct = totalEntradas > 0 ? (totalRepasses / totalEntradas) * 100 : 0;
  const despesaPct = totalEntradas > 0 ? (totalDespesas / totalEntradas) * 100 : 0;
  const lucroPct = totalEntradas > 0 ? Math.max(0, lucroLiquido / totalEntradas) * 100 : 0;

  // Cores padronizadas
  const TEXT_MAIN = [30, 41, 59] as [number, number, number];
  const TEXT_MUTED = [100, 116, 139] as [number, number, number];
  const TITLE_BLUE = [37, 99, 235] as [number, number, number];
  const SUCCESS_GREEN = [21, 128, 61] as [number, number, number];
  const DANGER_RED = [185, 28, 28] as [number, number, number];
  const BG_LIGHT = [248, 250, 252] as [number, number, number];

  // =====================
  // CABEÇALHO
  // =====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...TITLE_BLUE);
  doc.text('EXTRATO FINANCEIRO MENSAL', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Referência: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, 14, 27);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 196, 27, { align: 'right' });

  let cursorY = 38;
  
  // =====================
  // RESUMO DO MÊS
  // =====================
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(14, cursorY, 182, 38, 1, 1, 'FD');
  
  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MAIN);
  
  doc.text('Total recebido:', 20, cursorY);
  doc.text(`R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, cursorY, { align: 'right' });
  
  cursorY += 7;
  doc.text('Total de saídas:', 20, cursorY);
  doc.setTextColor(...DANGER_RED);
  doc.text(`-R$ ${totalSaidasCompilado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, cursorY, { align: 'right' });
  
  cursorY += 2;
  doc.setDrawColor(203, 213, 225);
  doc.line(20, cursorY, 100, cursorY);
  
  cursorY += 8;
  doc.setTextColor(...TEXT_MAIN);
  doc.text('Resultado final:', 20, cursorY);
  doc.setFontSize(12);
  doc.setTextColor(...(isPositivo ? SUCCESS_GREEN : DANGER_RED));
  doc.text(`R$ ${lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, cursorY, { align: 'right' });

  // Status Phrase
  cursorY += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...(isPositivo ? SUCCESS_GREEN : DANGER_RED));
  doc.text(isPositivo ? 'Seu caixa cresceu neste mês.' : 'Seu caixa reduziu neste mês.', 14, cursorY);

  cursorY += 12;

  // =====================
  // DISTRIBUIÇÃO
  // =====================
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TITLE_BLUE);
  doc.text('DISTRIBUIÇÃO DO DINHEIRO', 14, cursorY);
  
  cursorY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MAIN);
  doc.text('Repasses:', 14, cursorY);
  doc.text(`R$ ${totalRepasses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${repassePct.toFixed(0)}%)`, 100, cursorY, { align: 'right' });
  
  cursorY += 6;
  doc.text('Despesas gerais:', 14, cursorY);
  doc.text(`R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${despesaPct.toFixed(0)}%)`, 100, cursorY, { align: 'right' });
  
  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Lucro líquido:', 14, cursorY);
  doc.text(`R$ ${Math.max(0, lucroLiquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${lucroPct.toFixed(0)}%)`, 100, cursorY, { align: 'right' });

  cursorY += 15;

  // =====================
  // TABELA: ENTRADAS
  // =====================
  if (entradas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SUCCESS_GREEN);
    doc.text('ENTRADAS', 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['Data', 'Cliente / Descrição', 'Valor']],
      body: entradas.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao,
        { content: `R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } }
      ]),
      theme: 'plain',
      headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: SUCCESS_GREEN },
      styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
      columnStyles: { 2: { cellWidth: 40 } },
      margin: { left: 14, right: 14 }
    });
    cursorY = (doc as any).lastAutoTable.finalY + 12;
  }

  if (cursorY > 250) { doc.addPage(); cursorY = 20; }

  // =====================
  // TABELA: REPASSES
  // =====================
  if (repassesList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TITLE_BLUE);
    doc.text('REPASSES', 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['Data', 'Destino', 'Valor']],
      body: repassesList.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao,
        { content: `R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } }
      ]),
      theme: 'plain',
      headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: TITLE_BLUE },
      styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
      columnStyles: { 2: { cellWidth: 40 } },
      margin: { left: 14, right: 14 }
    });
    cursorY = (doc as any).lastAutoTable.finalY + 12;
  }

  if (cursorY > 250) { doc.addPage(); cursorY = 20; }

  // =====================
  // TABELA: DESPESAS GERAIS
  // =====================
  if (despesasList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DANGER_RED);
    doc.text('DESPESAS GERAIS', 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['Data', 'Descrição', 'Valor']],
      body: despesasList.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao,
        { content: `R$ ${t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } }
      ]),
      theme: 'plain',
      headStyles: { fontStyle: 'bold', textColor: [255, 255, 255], fillColor: DANGER_RED },
      styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
      columnStyles: { 2: { cellWidth: 40 } },
      margin: { left: 14, right: 14 }
    });
  }

  doc.save(`extrato_financeiro_${year}_${String(month + 1).padStart(2, '0')}.pdf`);
}

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
  const repassePct = totalEntradas > 0 ? (totalRepasses / totalEntradas) : 0;
  const despesaPct = totalEntradas > 0 ? (totalDespesas / totalEntradas) : 0;
  const lucroPct = totalEntradas > 0 ? Math.max(0, lucroLiquido / totalEntradas) : (isPositivo ? 0 : 0);

  // Cores
  const GREEN = [22, 163, 74] as [number, number, number]; 
  const RED = [220, 38, 38] as [number, number, number];
  const BLUE = [37, 99, 235] as [number, number, number];
  const NEUTRAL = [51, 65, 85] as [number, number, number];
  const LIGHT_GRAY = [241, 245, 249] as [number, number, number];

  // =====================
  // HEADER
  // =====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`EXTRATO FINANCEIRO MENSAL`, 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Referência: ${monthName.toUpperCase()}`, 14, 27);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 196, 27, { align: 'right' });

  let cursorY = 35;
  
  // =====================
  // RESUMO DO MÊS
  // =====================
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(14, cursorY, 182, 42, 2, 2, 'F');
  
  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NEUTRAL);
  doc.text('📌 RESUMO DO MÊS', 20, cursorY);

  cursorY += 8;
  doc.setFontSize(10);
  
  // Receitas
  doc.setFont('helvetica', 'normal');
  doc.text('💰 Total recebido:', 20, cursorY);
  doc.setFont('helvetica', 'bold');
  doc.text(`R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, cursorY, { align: 'right' });
  
  // Saídas
  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.text('💸 Total de saídas (Custo total):', 20, cursorY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  doc.text(`R$ ${totalSaidasCompilado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, cursorY, { align: 'right' });
  
  // Repasses (Sub-info)
  cursorY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`   (Sendo 🔁 Repasses: R$ ${totalRepasses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`, 20, cursorY);

  // Resultado Final
  cursorY = cursorY - 12; // Alinha resultado à direita do bloco
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NEUTRAL);
  doc.text('📊 Resultado final (Líquido):', 115, cursorY + 12);
  doc.setFontSize(14);
  doc.setTextColor(...(isPositivo ? GREEN : RED));
  doc.text(`R$ ${lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, cursorY + 22, { align: 'right' });
  
  // Frase Inteligente
  cursorY += 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const msgStr = isPositivo ? "📈 Seu caixa cresceu neste mês." : "⚠️ Seu caixa reduziu neste mês.";
  doc.text(msgStr, 20, cursorY);

  cursorY += 15;

  // =====================
  // BARRA DE PROPORÇÃO
  // =====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NEUTRAL);
  doc.text('📊 DISTRIBUIÇÃO DO DINHEIRO', 14, cursorY);
  
  cursorY += 6;
  const barWidth = 182;
  const barHeight = 8;
  const xStart = 14;
  
  // Desenha segmentos da barra
  let currentX = xStart;
  
  // Repasse
  if (repassePct > 0) {
    doc.setFillColor(...BLUE);
    const w = barWidth * Math.min(1, repassePct);
    doc.rect(currentX, cursorY, w, barHeight, 'F');
    currentX += w;
  }
  // Despesa
  if (despesaPct > 0) {
    doc.setFillColor(...RED);
    const w = barWidth * Math.min(1, despesaPct);
    doc.rect(currentX, cursorY, w, barHeight, 'F');
    currentX += w;
  }
  // Lucro
  if (lucroPct > 0 && isPositivo) {
    doc.setFillColor(...GREEN);
    const w = barWidth - (currentX - xStart);
    if (w > 0) doc.rect(currentX, cursorY, w, barHeight, 'F');
  } else if (!isPositivo) {
    // Se negativo, o que falta é vermelho escuro ou a barra ja foi preenchida pelas saidas
  }

  cursorY += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  doc.setTextColor(...BLUE);
  doc.text(`🔁 Repasses: R$ ${totalRepasses.toFixed(2)} (${(repassePct * 100).toFixed(0)}%)`, 14, cursorY);
  
  doc.setTextColor(...RED);
  doc.text(`💸 Despesas gerais: R$ ${totalDespesas.toFixed(2)} (${(despesaPct * 100).toFixed(0)}%)`, 75, cursorY);
  
  doc.setTextColor(...GREEN);
  doc.text(`💼 Lucro líquido: R$ ${Math.max(0, lucroLiquido).toFixed(2)} (${(lucroPct * 100).toFixed(0)}%)`, 140, cursorY);

  cursorY += 15;

  // =====================
  // TABELA: ENTRADAS
  // =====================
  if (entradas.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text('💰 ENTRADAS (RECEITAS)', 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['📅 Data', '👤 Cliente / Descrição', 'Valor']],
      body: entradas.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao,
        { content: `R$ ${t.valor.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]),
      theme: 'striped',
      headStyles: { fillColor: GREEN, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 30 } }
    });
    cursorY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Quebra de página se necessário
  if (cursorY > 240) { doc.addPage(); cursorY = 20; }

  // =====================
  // TABELA: REPASSES
  // =====================
  if (repassesList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...BLUE);
    doc.text('🔁 REPASSES', 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['📅 Data', 'Parceiro / Destino', 'Valor']],
      body: repassesList.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao,
        { content: `R$ ${t.valor.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]),
      theme: 'striped',
      headStyles: { fillColor: BLUE, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 30 } }
    });
    cursorY = (doc as any).lastAutoTable.finalY + 12;
  }

  if (cursorY > 240) { doc.addPage(); cursorY = 20; }

  // =====================
  // TABELA: DESPESAS GERAIS
  // =====================
  if (despesasList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...RED);
    doc.text('💸 DESPESAS GERAIS', 14, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['📅 Data', 'Descrição', 'Valor']],
      body: despesasList.map(t => [
        new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        t.descricao,
        { content: `R$ ${t.valor.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]),
      theme: 'striped',
      headStyles: { fillColor: RED, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { cellWidth: 30 } }
    });
  }

  // Gerar o PDF
  doc.save(`extrato_${year}_${String(month + 1).padStart(2, '0')}.pdf`);
}

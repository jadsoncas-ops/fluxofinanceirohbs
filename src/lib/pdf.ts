import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from './types';

export function generateMonthlyReport(transactions: Transaction[], month: number, year: number): void {
  const doc = new jsPDF();
  const monthName = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  // Foca EXCLUSIVAMENTE no Realizado (Dinheiro real na conta)
  const realizedTxs = transactions.filter(t => t.status === 'Concluído');
  
  const entradas = realizedTxs.filter(t => t.tipo === 'Entrada').sort((a,b) => a.data.localeCompare(b.data));
  const saidas = realizedTxs.filter(t => t.tipo === 'Saída').sort((a,b) => a.data.localeCompare(b.data));

  const totalEntradas = entradas.reduce((s, t) => s + t.valor, 0);
  const totalSaidas = saidas.reduce((s, t) => s + t.valor, 0);
  
  // Repasses extraídos das saídas
  const repassesList = saidas.filter(t => t.isRepasse);
  const totalRepasses = repassesList.reduce((s, t) => s + t.valor, 0);
  
  const saldoFinal = totalEntradas - totalSaidas;
  const isPositivo = saldoFinal >= 0;

  // Cores institucionais para o Relatório
  const GREEN = [22, 163, 74] as [number, number, number]; 
  const RED = [220, 38, 38] as [number, number, number];
  const NEUTRAL = [40, 50, 70] as [number, number, number];
  const BLACK = [10, 15, 20] as [number, number, number];

  // =====================
  // HEADER
  // =====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BLACK);
  doc.text(`Extrato Financeiro Executivo`, 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text(`Mês de Referência: ${monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()}`, 14, 27);

  let cursorY = 40;
  
  // =====================
  // BOX: RESUMO DO MÊS
  // =====================
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, cursorY, 182, 45, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, cursorY, 182, 45, 3, 3, 'S');
  
  cursorY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NEUTRAL);
  doc.text('Resumo de Resultados:', 18, cursorY);
  
  cursorY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  // Entradas
  doc.setTextColor(...GREEN);
  doc.text('✔ Você recebeu:', 18, cursorY);
  doc.text(`+ R$ ${totalEntradas.toFixed(2)}`, 85, cursorY, { align: 'right' });
  
  // Saidas
  cursorY += 6;
  doc.setTextColor(...RED);
  doc.text('⚠ Você pagou:', 18, cursorY);
  doc.text(`- R$ ${totalSaidas.toFixed(2)}`, 85, cursorY, { align: 'right' });
  
  // Sublinha do calculo
  cursorY += 3;
  doc.setDrawColor(200, 210, 220);
  doc.line(18, cursorY, 85, cursorY);
  
  // Saldo
  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NEUTRAL);
  doc.text('💰 Quanto sobrou:', 18, cursorY);
  doc.setFontSize(11);
  doc.setTextColor(...(isPositivo ? GREEN : RED));
  doc.text(`R$ ${saldoFinal.toFixed(2)}`, 85, cursorY, { align: 'right' });
  
  // Insight Crescimento
  cursorY += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100);
  const insightCrescimento = isPositivo 
        ? "📌 Seu caixa cresceu neste período." 
        : (saldoFinal < 0 ? "📌 Atenção: Seu caixa diminuiu neste período." : "📌 Seu caixa fechou no limite zero a zero.");
  doc.text(insightCrescimento, 18, cursorY);

  // =====================
  // BLOCO: DISTRIBUIÇÃO
  // =====================
  cursorY += 22; // sai da box
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NEUTRAL);
  doc.text('Como o dinheiro foi distribuído (Destaque):', 14, cursorY);
  
  cursorY += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Recebido: R$ ${totalEntradas.toFixed(2)}`, 14, cursorY);
  
  cursorY += 6;
  const repassePct = totalEntradas > 0 ? ((totalRepasses / totalEntradas) * 100).toFixed(1) : '0.0';
  doc.setTextColor(...RED);
  doc.text(`Repasses Realizados: - R$ ${totalRepasses.toFixed(2)}   (${repassePct}% da receita foram repassados)`, 14, cursorY);
  
  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NEUTRAL);
  doc.text(`Valor líquido final: R$ ${(totalEntradas - totalRepasses).toFixed(2)}`, 14, cursorY);
  
  // Insight Despesas
  cursorY += 7;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(130);
  let gastoInsight = '';
  if (totalSaidas > totalEntradas) {
     gastoInsight = '⚠ Você gastou mais do que recebeu neste mês.';
  } else {
     const gastoPct = totalEntradas > 0 ? ((totalSaidas / totalEntradas) * 100).toFixed(1) : '0';
     gastoInsight = `📌 Seus pagamentos gerais e obras consumiram ${gastoPct}% da receita mensal. O saldo ficou pra você.`;
  }
  doc.text(gastoInsight, 14, cursorY);

  cursorY += 15;
  
  // =====================
  // LISTA DE O QUE RECEBEU
  // =====================
  if (entradas.length > 0) {
     doc.setFont('helvetica', 'bold');
     doc.setFontSize(13);
     doc.setTextColor(...GREEN);
     doc.text('🟩 Entradas (Você recebeu)', 14, cursorY);
     cursorY += 4;
     
     autoTable(doc, {
       startY: cursorY,
       head: [['Data', 'Origem / Cliente', 'Categoria', 'Valor recebido']],
       body: entradas.map(t => [
         new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
         t.descricao,
         t.categoria,
         `R$ ${t.valor.toFixed(2)}`,
       ]),
       styles: { fontSize: 9, cellPadding: 3 },
       headStyles: { fillColor: [40, 160, 80], textColor: 255 },
       alternateRowStyles: { fillColor: [248, 252, 248] },
     });
     
     cursorY = Math.round((doc as any).lastAutoTable.finalY) + 15;
  }
  
  // Quebra de página protetora
  if (cursorY > 230) {
      doc.addPage();
      cursorY = 20;
  }
  
  // =====================
  // LISTA DE O QUE PAGOU
  // =====================
  if (saidas.length > 0) {
     doc.setFont('helvetica', 'bold');
     doc.setFontSize(13);
     doc.setTextColor(...RED);
     doc.text('🟥 Saídas (Você pagou)', 14, cursorY);
     cursorY += 4;
     
     autoTable(doc, {
       startY: cursorY,
       head: [['Data', 'Destino / Custos', 'Sinalização', 'Categoria', 'Valor pago']],
       body: saidas.map(t => [
         new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
         t.descricao,
         t.isRepasse ? 'Repasse / Obra' : 'Geral',
         t.categoria,
         `R$ ${t.valor.toFixed(2)}`,
       ]),
       styles: { fontSize: 9, cellPadding: 3 },
       headStyles: { fillColor: [200, 60, 60], textColor: 255 },
       alternateRowStyles: { fillColor: [253, 245, 245] },
     });
  }

  // Finalização do Documento
  doc.save(`extrato_caixa_${year}_${String(month + 1).padStart(2, '0')}.pdf`);
}

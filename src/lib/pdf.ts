import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction } from './types';

export function generateMonthlyReport(transactions: Transaction[], month: number, year: number): void {
  const doc = new jsPDF();
  const monthName = new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const entradas = transactions.filter(t => t.tipo === 'Entrada' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
  const saidas = transactions.filter(t => t.tipo === 'Saída' && t.status === 'Concluído').reduce((s, t) => s + t.valor, 0);
  const aReceber = transactions.filter(t => t.tipo === 'A Receber').reduce((s, t) => s + t.valor, 0);
  const aPagar = transactions.filter(t => t.tipo === 'A Pagar').reduce((s, t) => s + t.valor, 0);
  const saldo = entradas - saidas;

  // Header
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Eng. Jádson Castro - Gestão Financeira', 14, 15);

  doc.setFontSize(16);
  doc.setTextColor(30, 40, 70);
  doc.text(`Relatório Financeiro`, 14, 28);

  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), 14, 35);

  // Summary
  doc.setFontSize(10);
  const summaryY = 45;
  doc.setTextColor(40);
  doc.text(`Saldo do Mês: R$ ${saldo.toFixed(2)}`, 14, summaryY);
  doc.text(`Total Entradas: R$ ${entradas.toFixed(2)}`, 14, summaryY + 6);
  doc.text(`Total Saídas: R$ ${saidas.toFixed(2)}`, 14, summaryY + 12);
  doc.text(`A Receber: R$ ${aReceber.toFixed(2)}`, 110, summaryY);
  doc.text(`A Pagar: R$ ${aPagar.toFixed(2)}`, 110, summaryY + 6);

  // Table
  const sorted = [...transactions].sort((a, b) => a.data.localeCompare(b.data));
  autoTable(doc, {
    startY: summaryY + 22,
    head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Status']],
    body: sorted.map(t => [
      new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR'),
      t.tipo,
      t.categoria,
      t.descricao,
      t.valor.toFixed(2),
      t.status,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 45, 80], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`relatorio_${year}_${String(month + 1).padStart(2, '0')}.pdf`);
}

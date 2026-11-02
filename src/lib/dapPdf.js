// PDF DAP: per salesman -> halaman DAP utama, lalu (opsional) halaman Fokus Pareto (satu toko = satu kartu). A4 landscape.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cardColumns, cardHeadLine, cardRows, weekdayName } from './dapModel.js';

const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const rp = (n) => Math.round(n || 0).toLocaleString('id-ID');
const clean = (s) => String(s ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '');
const PURPLE = [139, 123, 216];
const BLUE = [74, 143, 219];

function colStyles(cols, usable) {
  const fixed = cols.reduce((a, c) => a + (c.w || 0), 0);
  const autoMin = cols.some((c) => !c.w) ? 24 : 0;
  const scale = fixed > usable - autoMin ? (usable - autoMin) / fixed : 1;
  const out = {};
  cols.forEach((c, i) => {
    out[i] = { halign: c.al || 'left', ...(c.w ? { cellWidth: c.w * scale } : { cellWidth: 'auto' }), ...(c.bold ? { fontStyle: 'bold' } : {}) };
  });
  return { styles: out, scale };
}

export async function makeDapPdf({ data, model, only, y, m, d, cfg, asOf, depot }) {
  const groups = only ? model.groups.filter((g) => g.name === only) : model.groups;
  if (!groups.length) throw new Error('Tidak ada toko untuk dicetak');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const accent = depot === 'kapuk' ? BLUE : PURPLE;
  const tgl = `${weekdayName(model.wd)}, ${d} ${MON[m - 1]} ${y}`;
  const team = data.meta.teamLabel || '';
  let first = true;
  const newPage = () => { if (!first) doc.addPage(); first = false; };

  const header = (title, sub, rTop, rSub) => {
    doc.setFillColor(...accent);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(clean(title), 10, 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(clean(sub), 10, 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(clean(rTop), W - 10, 8, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(clean(rSub), W - 10, 14, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  for (const g of groups) {
    // ===== DAP utama =====
    newPage();
    header(`DAP ${team.toUpperCase()} - ${g.name}`, `${tgl}  |  ${g.n} toko  |  Actual s/d ${asOf}`, `Total PLAN: Rp ${rp(g.plan)}`, `Target DAP: Rp ${rp(g.target)}  |  Actual: Rp ${rp(g.actual)}`);
    const { styles, scale } = colStyles(model.head, W - 16);
    const fs = Math.max(5.5, 7.5 * Math.min(1, scale + 0.15));
    autoTable(doc, {
      startY: 22,
      margin: { left: 8, right: 8, top: 22, bottom: 12 },
      styles: { fontSize: fs, cellPadding: 1.3, lineColor: [215, 215, 232], lineWidth: 0.15, valign: 'middle', overflow: 'ellipsize' },
      headStyles: { fillColor: accent, textColor: 255, fontSize: fs, halign: 'center', overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [247, 246, 252] },
      head: [model.head.map((c) => c.label)],
      body: g.rows.map((x) => x.cells.map((v) => (typeof v === 'string' ? clean(v) : v))),
      columnStyles: styles,
      didParseCell: (h) => {
        const c = model.head[h.column.index];
        if (h.section === 'body' && c?.neg && String(h.cell.raw).startsWith('-')) h.cell.styles.textColor = [200, 40, 60];
        if (h.section === 'body' && h.cell.raw === 'tercapai') h.cell.styles.textColor = [30, 140, 80];
      },
      didDrawPage: () => {
        doc.setFontSize(7); doc.setTextColor(120, 120, 150);
        doc.text(clean(`${g.name} - ${tgl}`), 8, H - 5);
        doc.text(`Halaman ${doc.getNumberOfPages()}`, W - 8, H - 5, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      },
    });

    // ===== Fokus Pareto: satu toko = satu halaman (atau dua) =====
    if (cfg.par.on && g.cards.length && cfg.par.focus.length) {
      const cols = cardColumns(cfg.par, model.hasTgt);
      const { styles: cs } = colStyles(cols, W - 16);
      let y2 = null; // posisi Y bebas di halaman bila 2 kartu per halaman
      g.cards.forEach((card, ci) => {
        const rows = cardRows(card, cols);
        const need = 34 + rows.length * 7 + (cfg.par.notes ? 22 : 0);
        const canShare = cfg.par.perPage === 2 && y2 != null && y2 + need < H - 12;
        if (!canShare) { newPage(); y2 = null; }
        const top = canShare ? y2 : 0;
        const s = card.s;
        const dr = card.dr;
        if (!canShare) {
          header(`${s.name}`, `${s.id}  |  ${g.name}  |  ${s.cc1 && s.cc1 !== '-' ? s.cc1 : ''}  |  ${tgl}`, dr ? `PLAN: ${dr.done ? 'tercapai' : 'Rp ' + rp(dr.plan)}` : 'Fokus Pareto', dr ? `Target DAP: Rp ${rp(dr.t)}  |  Actual: Rp ${rp(dr.a)}  |  Gap: ${rp(dr.gap)}` : `Actual MTD: Rp ${rp(s.act)}`);
        } else {
          doc.setFillColor(...accent);
          doc.rect(8, top, W - 16, 10, 'F');
          doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text(clean(`${s.name}  (${s.id})`), 10, top + 6.5);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
          doc.text(clean(dr ? `Target DAP ${rp(dr.t)}  |  Actual ${rp(dr.a)}  |  PLAN ${dr.done ? 'tercapai' : rp(dr.plan)}` : `Actual MTD ${rp(s.act)}`), W - 10, top + 6.5, { align: 'right' });
          doc.setTextColor(0, 0, 0);
        }
        const sy = canShare ? top + 12 : 22;
        if (cfg.par.hdr) {
          doc.setFontSize(8); doc.setTextColor(90, 90, 120);
          doc.text(clean(cardHeadLine(card)), 10, sy + 2);
          doc.setTextColor(0, 0, 0);
        }
        autoTable(doc, {
          startY: sy + (cfg.par.hdr ? 5 : 1),
          margin: { left: 8, right: 8, bottom: 12 },
          styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [215, 215, 232], lineWidth: 0.15, valign: 'middle', overflow: 'ellipsize', minCellHeight: 7 },
          headStyles: { fillColor: [235, 232, 250], textColor: [60, 50, 120], fontSize: 8, halign: 'center' },
          head: [cols.map((c) => c.label)],
          body: rows.map((r) => r.map((v) => clean(v))),
          columnStyles: cs,
          didParseCell: (h) => {
            if (h.section === 'body' && h.row.index === rows.length - 1 && card.items.length > 1) h.cell.styles.fontStyle = 'bold';
          },
        });
        let endY = doc.lastAutoTable.finalY;
        if (cfg.par.notes) {
          const bh = Math.min(26, H - 14 - endY - 2);
          if (bh > 10) {
            doc.setDrawColor(190, 190, 215); doc.setLineWidth(0.2);
            doc.rect(8, endY + 4, W - 16, bh);
            doc.setFontSize(7.5); doc.setTextColor(130, 130, 160);
            doc.text('Hasil kunjungan / kendala / janji order', 10, endY + 8);
            doc.setTextColor(0, 0, 0);
            endY += bh + 4;
          }
        }
        if (card.notInDap) { doc.setFontSize(7); doc.setTextColor(180, 110, 0); doc.text('Toko Pareto ini tidak ada di DAP utama (cek rute / sheet DAP)', 10, endY + 5); doc.setTextColor(0, 0, 0); }
        y2 = cfg.par.perPage === 2 ? endY + 10 : null;
        doc.setFontSize(7); doc.setTextColor(120, 120, 150);
        if (!canShare) doc.text(clean(`Fokus Pareto ${ci + 1}/${g.cards.length}  -  ${g.name}`), 8, H - 5);
        doc.setTextColor(0, 0, 0);
      });
    }
  }
  const tag = only ? only.split(' ')[0] : 'semua-salesman';
  doc.save(`DAP-${depot}-${team}-${tag}-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}.pdf`);
}

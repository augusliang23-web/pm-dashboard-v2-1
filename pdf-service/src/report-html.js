export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

export function reportDocument({ title, period, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing:border-box; } body { color:#26384a; font:10pt Arial,sans-serif; }
    h1 { margin:0; font-size:22pt; } h2 { margin:0 0 4mm; font-size:13pt; } .kicker { color:#57967f; font-size:8pt; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
    .report-head { display:flex; justify-content:space-between; border-bottom:1px solid #cbd6e1; padding-bottom:4mm; margin-bottom:7mm; } .report-meta { color:#718196; font-size:8pt; }
    .section { break-inside:avoid; margin:0 0 7mm; } .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5mm; } .card { border:1px solid #d7dee7; border-radius:4mm; padding:4mm; break-inside:avoid; }
    .milestone-timeline { display:grid; grid-template-columns:repeat(var(--count),minmax(0,1fr)); gap:5mm; border-top:1px solid #cbd6e1; padding-top:6mm; } .milestone-timeline article { min-width:0; } .milestone-list { list-style:none; padding:0; margin:0; } .milestone-list li { display:grid; grid-template-columns:42mm 1fr 26mm; gap:4mm; padding:3mm 0; border-bottom:1px solid #d7dee7; break-inside:avoid; }
    table { width:100%; border-collapse:collapse; } th { text-align:left; color:#718196; font-size:8pt; text-transform:uppercase; } td,th { border-bottom:1px solid #d7dee7; padding:3mm; } tr { break-inside:avoid; } thead { display:table-header-group; }
  </style></head><body><header class="report-head"><div><div class="kicker">Project Dashboard</div><h1>${escapeHtml(title)}</h1></div><div class="report-meta">${escapeHtml(period || 'Current reporting period')}</div></header>${body}</body></html>`;
}

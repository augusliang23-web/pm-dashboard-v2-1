export const REPORT_CSS = `
  @page { size: A4 landscape; margin:0; }
  :root {
    --ink:#26384a;
    --muted:#718196;
    --line:#d7dee7;
    --surface:#f5f8fb;
    --green:#57967f;
    --green-soft:#e8f3ee;
    --yellow:#c99732;
    --yellow-soft:#fff5dc;
    --red:#b85c5c;
    --red-soft:#fdecec;
    --blue:#5b7fa3;
    --white:#fff;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; padding:0; background:var(--white); }
  body {
    color:var(--ink);
    font:9.5pt Arial,"Noto Sans CJK TC",sans-serif;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  h1,h2,h3,p { margin-top:0; }
  h1 { margin-bottom:1mm; font-size:20pt; line-height:1.1; }
  h2 { margin-bottom:3mm; font-size:13pt; line-height:1.2; }
  h3 { margin-bottom:2mm; font-size:10pt; line-height:1.25; }
  .report-document { width:100%; }
  .report-page {
    width:297mm;
    min-height:210mm;
    padding:11mm 12mm 9mm;
    break-after:page;
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }
  .report-page:last-child { break-after:auto; }
  .report-page-head {
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:8mm;
    padding-bottom:4mm;
    border-bottom:1px solid var(--line);
  }
  .report-kicker {
    margin-bottom:1.5mm;
    color:var(--green);
    font-size:7.5pt;
    font-weight:700;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .report-title { margin:0; }
  .report-meta { color:var(--muted); font-size:8pt; white-space:nowrap; }
  .report-body { flex:1; min-height:0; padding-top:5mm; }
  .report-footer {
    display:flex;
    justify-content:space-between;
    gap:8mm;
    padding-top:3mm;
    color:var(--muted);
    font-size:7.5pt;
  }
  .card {
    border:1px solid var(--line);
    border-radius:4mm;
    background:var(--white);
    padding:4mm;
    break-inside:avoid;
  }
  .card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:4mm; }
  .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:3mm; }
  .metric-card-label { color:var(--muted); font-size:7.5pt; font-weight:700; text-transform:uppercase; }
  .metric-card-value { margin-top:1.5mm; font-size:18pt; font-weight:800; line-height:1; }
  .metric-card-detail { margin-top:1.5mm; color:var(--muted); font-size:8pt; }
  .metric-card.yellow { background:var(--yellow-soft); }
  .metric-card.red { background:var(--red-soft); }
  .metric-card.green { background:var(--green-soft); }
  .status-badge {
    display:inline-flex;
    align-items:center;
    border-radius:99px;
    padding:1.2mm 2.4mm;
    font-size:8pt;
    font-weight:700;
  }
  .status-badge.green { color:var(--green); background:var(--green-soft); }
  .status-badge.yellow { color:#8a641c; background:var(--yellow-soft); }
  .status-badge.red { color:var(--red); background:var(--red-soft); }
  .status-badge.neutral { color:var(--muted); background:var(--surface); }
  .progress-track { height:3mm; border-radius:99px; overflow:hidden; background:#e6ecf2; }
  .progress-fill { height:100%; background:var(--green); }
  .progress-fill.yellow { background:var(--yellow); }
  .progress-fill.red { background:var(--red); }
  table { width:100%; border-collapse:collapse; }
  thead { display:table-header-group; }
  tr,.keep-together { break-inside:avoid; }
  th,td { padding:2.4mm; border-bottom:1px solid var(--line); vertical-align:top; }
  th {
    color:var(--muted);
    font-size:7.5pt;
    letter-spacing:.04em;
    text-align:left;
    text-transform:uppercase;
  }
  .empty-state {
    border:1px dashed var(--line);
    border-radius:3mm;
    padding:6mm;
    color:var(--muted);
    text-align:center;
  }
`;

'use client';
import { useState } from 'react';
import { getReport, type ReportFormat } from '@/lib/reporting/registry';
import { getProvider } from '@/lib/reporting/providers/factory';
import { buildReportLayout } from '@/lib/reporting/layout/engine';
import { getRenderer } from '@/lib/reporting/renderers/factory';
import { downloadBlob } from '@/lib/reporting/renderers/download';

interface ExportButtonProps { reportId: string; entityId: string; periodId?: string; companyName?: string; label?: string; }
export default function ExportButton({ reportId, entityId, periodId, companyName, label = 'Export' }: ExportButtonProps) {
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false);
  const report = getReport(reportId);
  async function handleExport(format: ReportFormat) {
    setLoading(true);
    try {
      const provider = getProvider(reportId);
      if (!provider) return;
      const data = await provider({ entityId, periodId });
      const filename = `${report?.title || 'report'}-${new Date().toISOString().split('T')[0]}`;
      const layout = buildReportLayout({
        companyName: companyName || 'Company',
        reportTitle: report?.title || 'Report',
        orientation: report?.orientation || 'portrait',
        period: periodId,
        sections: [{ headers: data.headers, rows: data.rows, totals: data.totals }],
      });
      const fmt = format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
      const renderer = getRenderer(fmt);
      if (renderer) {
        const result = await renderer.render(layout);
        downloadBlob(result.blob, `${filename}.${result.extension}`);
      }
    } catch (err) { console.error('Export failed', err); }
    finally { setLoading(false); setOpen(false); }
  }
  if (!report) return null;
  return (<div className="relative"><button onClick={() => setOpen(!open)} disabled={loading} className="text-xs text-zinc-500 hover:text-white border border-white/[0.08] rounded-lg px-3 py-1.5">{loading ? '...' : label}</button>{open && (<><div className="fixed inset-0 z-10" onClick={() => setOpen(false)} /><div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-20 w-32">{report.formats.map(f => (<button key={f} onClick={() => handleExport(f)} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-white uppercase">{f}</button>))}</div></>)}</div>);
}

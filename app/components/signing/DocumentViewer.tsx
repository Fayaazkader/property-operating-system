'use client';

import { useState, useRef } from 'react';
import { fieldsToPixels, pixelFieldToNormalised, type CanvasField } from '@/lib/signing/canvas-service';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

interface SignatureField {
  id: string;
  type: 'signature' | 'initial' | 'date' | 'text' | 'checkbox' | 'stamp' | 'witness';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  signerRole?: string;
  isTemplate?: boolean;
  isReplica?: boolean;
  templateId?: string;
}

interface Props {
  fileUrl: string;
  fields: SignatureField[];
  onFieldAdd: (field: SignatureField) => void;
  onFieldMove: (id: string, x: number, y: number) => void;
  onFieldClick: (field: SignatureField) => void;
  readOnly?: boolean;
}

export default function DocumentViewer({ fileUrl, fields, onFieldAdd, onFieldMove, onFieldClick, readOnly }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pageDims, setPageDims] = useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pageRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function handlePageClick(e: React.MouseEvent) {
    if (readOnly || dragging) return;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    if (pageDims) {
      const norm = pixelFieldToNormalised({ id: '', page: currentPage, x, y, width: 200, height: 50 }, pageDims);
      onFieldAdd({ ...norm, id: crypto.randomUUID(), type: 'signature' });
    }
  }

  function handleMouseDown(e: React.MouseEvent, field: SignatureField) {
    if (readOnly) { onFieldClick(field); return; }
    e.stopPropagation();
    setDragging(field.id);
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragOffset({
      x: (e.clientX - rect.left) / scale - field.x,
      y: (e.clientY - rect.top) / scale - field.y,
    });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale - dragOffset.x;
    const y = (e.clientY - rect.top) / scale - dragOffset.y;
    onFieldMove(dragging, Math.round(x), Math.round(y));
  }

  const pageFields = fields.filter(f => f.page === currentPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 rounded-lg border border-white/[0.08] text-xs text-white hover:border-white/20 disabled:opacity-30">←</button>
          <span className="text-xs text-zinc-400">Page {currentPage} / {numPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="px-3 py-1 rounded-lg border border-white/[0.08] text-xs text-white hover:border-white/20 disabled:opacity-30">→</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="px-2 py-1 rounded-lg border border-white/[0.08] text-xs text-white">−</button>
          <span className="text-xs text-zinc-400">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} className="px-2 py-1 rounded-lg border border-white/[0.08] text-xs text-white">+</button>
        </div>
      </div>

      <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-zinc-900 flex justify-center">
        <div ref={pageRef} style={{ position: 'relative', cursor: readOnly ? 'default' : 'crosshair' }}
          onClick={handlePageClick} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}>
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="p-20 text-zinc-500">Loading...</div>}>
            <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} onLoadSuccess={(page) => { setPageDims({ width: page.originalWidth, height: page.originalHeight }); }} />
          </Document>
          {pageFields.map(field => (
            <div key={field.id} onMouseDown={(e) => handleMouseDown(e, field)}
              onClick={(e) => { e.stopPropagation(); onFieldClick(field); }}
              style={{ position: 'absolute', ...(pageDims ? (() => { const px = fieldsToPixels([field as CanvasField], pageDims)[0]; return { left: px.x, top: px.y, width: px.width, height: px.height }; })() : { left: field.x, top: field.y, width: field.width, height: field.height }),
                cursor: readOnly ? 'pointer' : 'move', zIndex: dragging === field.id ? 50 : 10,
                border: field.value ? '2px solid rgba(16,185,129,0.5)' : '2px dashed rgba(255,255,255,0.3)',
                borderRadius: '8px', background: field.value ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {field.value ? (
                field.type === 'signature' || field.type === 'initial' || field.type === 'witness' ? (
                  <img src={field.value} alt="Signature" className="max-w-full max-h-full object-contain" />
                ) : <span className="text-xs text-emerald-400">{field.value}</span>
              ) : (
                <span className="text-[10px] text-zinc-500">
                  {field.type === 'signature' ? 'Signature' : field.type === 'initial' ? 'Initials' : field.type === 'witness' ? 'Witness' : field.type === 'date' ? 'Date' : field.type}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { CoordinateTransformService, type CanvasField } from '@/lib/signing/coordinate-transform-service';
import type { SigningField } from '@/lib/signing/types';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

interface Props {
  fileUrl: string;
  fields: SigningField[];
  activeTool?: string | null;
  duplicateMode?: boolean;
  selectedFieldId?: string;
  placingMode?: boolean;
  onFieldAdd: (field: SigningField) => void;
  onFieldMove: (id: string, x: number, y: number) => void;
  onFieldClick: (field: SigningField) => void;
  onFieldDoubleClick?: (field: SigningField) => void;
  onFieldDelete?: (id: string) => void;
  readOnly?: boolean;
}

export default function DocumentViewer({ 
  fileUrl, fields, activeTool, duplicateMode, selectedFieldId, placingMode,
  onFieldAdd, onFieldMove, onFieldClick, onFieldDoubleClick, onFieldDelete, readOnly 
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pageDims, setPageDims] = useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pageRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) { setNumPages(numPages); }

  // Page click — place field
  function handlePageClick(e: React.MouseEvent) {
    if (readOnly || dragging || !activeTool || !placingMode) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect || !pageDims) { isProcessingRef.current = false; return; }

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const field: SigningField = {
      id: crypto.randomUUID(),
      type: activeTool as any,
      page: currentPage,
      x: Math.round(x),
      y: Math.round(y),
      width: activeTool === 'checkbox' ? 24 : 200,
      height: activeTool === 'checkbox' ? 24 : 50,
    };

    onFieldAdd(field);
    setTimeout(() => { isProcessingRef.current = false; }, 150);
  }

  // Field click — select or start drag
  function handleFieldMouseDown(e: React.MouseEvent, field: SigningField) {
    e.stopPropagation();
    e.preventDefault();

    if (readOnly) { onFieldClick(field); return; }

    // Select field
    onFieldClick(field);

    // Start drag
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left) / scale;
    const clickY = (e.clientY - rect.top) / scale;

    setDragging(field.id);
    setDragOffset({
      x: clickX - field.x,
      y: clickY - field.y,
    });
  }

  function handleFieldDoubleClick(e: React.MouseEvent, field: SigningField) {
    e.stopPropagation();
    e.preventDefault();
    onFieldDoubleClick?.(field);
  }

  // Global mouse move — handle drag
  useEffect(() => {
    if (!dragging) return;

    function handleGlobalMouseMove(e: MouseEvent) {
      if (!pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale - dragOffset.x;
      const y = (e.clientY - rect.top) / scale - dragOffset.y;
      onFieldMove(dragging!, Math.round(x), Math.round(y));
    }

    function handleGlobalMouseUp() { setDragging(null); }

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragging, dragOffset, scale, onFieldMove]);

  // Keyboard: Delete selected field
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' && selectedFieldId) {
        onFieldDelete?.(selectedFieldId);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, onFieldDelete]);

  const pageFields = fields.filter(f => f.page === currentPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-3 py-1 rounded-lg border border-white/[0.08] text-xs text-white hover:border-white/20 disabled:opacity-30">Prev</button>
          <span className="text-xs text-zinc-400">Page {currentPage} / {numPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages} className="px-3 py-1 rounded-lg border border-white/[0.08] text-xs text-white hover:border-white/20 disabled:opacity-30">Next</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="px-2 py-1 rounded-lg border border-white/[0.08] text-xs text-white">-</button>
          <span className="text-xs text-zinc-400">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} className="px-2 py-1 rounded-lg border border-white/[0.08] text-xs text-white">+</button>
        </div>
      </div>

      <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-zinc-900 flex justify-center">
        <div ref={pageRef}
          style={{ position: 'relative', cursor: readOnly ? 'default' : placingMode && activeTool ? 'crosshair' : 'default' }}
          onClick={handlePageClick}>
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="p-20 text-zinc-500">Loading...</div>}>
            <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false}
              onLoadSuccess={(page: any) => { setPageDims({ width: page.originalWidth, height: page.originalHeight }); }} />
          </Document>
          
          {/* Field Overlays */}
          {pageFields.map(field => {
            const px = pageDims ? CoordinateTransformService.toPixels(field as CanvasField, pageDims) : field;
            const isSelected = selectedFieldId === field.id;
            return (
              <div key={field.id}
                onMouseDown={(e) => handleFieldMouseDown(e, field)}
                onDoubleClick={(e) => handleFieldDoubleClick(e, field)}
                style={{
                  position: 'absolute', left: px.x, top: px.y, width: px.width, height: px.height,
                  cursor: readOnly ? 'pointer' : 'move', zIndex: isSelected ? 50 : dragging === field.id ? 40 : 10,
                  border: isSelected ? '2px solid rgba(255,255,255,0.7)' : field.value ? '2px solid rgba(16,185,129,0.4)' : '2px dashed rgba(255,255,255,0.25)',
                  borderRadius: '6px', background: isSelected ? 'rgba(255,255,255,0.06)' : field.value ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                {field.value ? (
                  field.type === 'signature' || field.type === 'initial' || field.type === 'witness' ? (
                    <img src={field.value} alt="Signature" className="max-w-full max-h-full object-contain" style={{ background: 'transparent', mixBlendMode: 'multiply' }} />
                  ) : field.type === 'checkbox' ? (
                    <span className="text-lg text-emerald-400">✓</span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium">{field.value}</span>
                  )
                ) : (
                  <span className="text-[10px] text-zinc-500 font-light select-none">
                    {field.type === 'signature' ? 'Signature' : field.type === 'initial' ? 'Initials' : field.type === 'witness' ? 'Witness' : field.type === 'date' ? 'Date' : field.type === 'checkbox' ? '☐' : field.type}
                    {field.signerRole ? ` · ${field.signerRole}` : ''}
                  </span>
                )}

                {/* Resize handles on selected field */}
                {isSelected && !readOnly && (
                  <>
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white rounded-full cursor-nw-resize" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full cursor-ne-resize" />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white rounded-full cursor-sw-resize" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white rounded-full cursor-se-resize" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

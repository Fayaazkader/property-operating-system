'use client';

import { useState, useRef, useEffect } from 'react';
import { CoordinateTransformService, type CanvasField } from '@/lib/signing/coordinate-transform-service';
import type { SigningField } from '@/lib/signing/types';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

interface Props {
  fileUrl: string;
  fields: SigningField[];
  activeTool?: string | null;
  duplicateFieldId?: string | null;
  selectedFieldId?: string;
  placingMode?: boolean;
  readOnly?: boolean;
  onPageClick: (x: number, y: number, page: number) => void;
  onFieldMove: (id: string, x: number, y: number) => void;
  onFieldResize: (id: string, width: number, height: number) => void;
  onFieldClick: (field: SigningField) => void;
  onFieldDoubleClick?: (field: SigningField) => void;
}

export default function DocumentViewer({ 
  fileUrl, fields, activeTool, duplicateFieldId, selectedFieldId, placingMode, readOnly,
  onPageClick, onFieldMove, onFieldResize, onFieldClick, onFieldDoubleClick,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pageDims, setPageDims] = useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 });
  const pageRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) { setNumPages(numPages); }

  // Page click — emit coordinates only, parent decides what to create
  function handlePageClick(e: React.MouseEvent) {
    if (readOnly || dragging || resizing || !placingMode) return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) { isProcessingRef.current = false; return; }

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    onPageClick(Math.round(x), Math.round(y), currentPage);

    setTimeout(() => { isProcessingRef.current = false; }, 150);
  }

  // Field mouse down — select, start drag, or start resize
  function handleFieldMouseDown(e: React.MouseEvent, field: SigningField, handle?: string) {
    e.stopPropagation();
    e.preventDefault();
    if (readOnly) { onFieldClick(field); return; }

    onFieldClick(field);

    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    if (handle) {
      // Start resize
      setResizing({ id: field.id, handle });
      setResizeStart({ x: field.x, y: field.y, w: field.width, h: field.height, mx, my });
    } else {
      // Start drag
      setDragging(field.id);
      setDragOffset({ x: mx - field.x, y: my - field.y });
    }
  }

  function handleFieldDoubleClick(e: React.MouseEvent, field: SigningField) {
    e.stopPropagation();
    e.preventDefault();
    onFieldDoubleClick?.(field);
  }

  // Global mouse move — drag or resize
  useEffect(() => {
    if (!dragging && !resizing) return;

    function handleGlobalMouseMove(e: MouseEvent) {
      if (!pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top) / scale;

      if (dragging) {
        const x = mx - dragOffset.x;
        const y = my - dragOffset.y;
        onFieldMove(dragging, Math.round(x), Math.round(y));
      }

      if (resizing) {
        const dx = mx - resizeStart.mx;
        const dy = my - resizeStart.my;
        let newW = resizeStart.w;
        let newH = resizeStart.h;

        if (resizing.handle.includes('e')) newW = Math.max(20, resizeStart.w + dx);
        if (resizing.handle.includes('w')) newW = Math.max(20, resizeStart.w - dx);
        if (resizing.handle.includes('s')) newH = Math.max(20, resizeStart.h + dy);
        if (resizing.handle.includes('n')) newH = Math.max(20, resizeStart.h - dy);

        onFieldResize(resizing.id, Math.round(newW), Math.round(newH));
      }
    }

    function handleGlobalMouseUp() { setDragging(null); setResizing(null); }

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragging, resizing, dragOffset, resizeStart, scale, onFieldMove, onFieldResize]);

  const pageFields = fields.filter(f => f.page === currentPage);

  const toolLabel = activeTool ? `${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)} Tool` : '';
  const duplicatingLabel = duplicateFieldId ? 'Duplicating' : '';

  return (
    <div className="space-y-4">
      {/* Tool banner */}
      {activeTool && placingMode && (
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-white font-medium">{toolLabel}</span>
            <span className="text-[10px] text-zinc-500">Click anywhere to place · Press ESC to cancel</span>
          </div>
          <div className="flex items-center gap-2">
            {duplicatingLabel && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{duplicatingLabel}</span>
            )}
            {!duplicatingLabel && (
              <span className="text-[10px] text-zinc-600">Single placement</span>
            )}
          </div>
        </div>
      )}

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

                {isSelected && !readOnly && (
                  <>
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white rounded-full cursor-nw-resize" onMouseDown={(e) => handleFieldMouseDown(e, field, 'nw')} />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full cursor-ne-resize" onMouseDown={(e) => handleFieldMouseDown(e, field, 'ne')} />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white rounded-full cursor-sw-resize" onMouseDown={(e) => handleFieldMouseDown(e, field, 'sw')} />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white rounded-full cursor-se-resize" onMouseDown={(e) => handleFieldMouseDown(e, field, 'se')} />
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

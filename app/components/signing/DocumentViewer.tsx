'use client';

import { useState, useRef, useEffect } from 'react';
import { CoordinateTransformService, type CanvasField } from '@/lib/signing/coordinate-transform-service';
import type { SigningField } from '@/lib/signing/types';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;

interface PageClickEvent {
  x: number;
  y: number;
  page: number;
  normalizedWidth: number;
  normalizedHeight: number;
}

interface Props {
  duplicatePreview?: { x: number; y: number; width: number; height: number; type: string; value?: string } | null;
  onPageCountChange?: (count: number) => void;
  fileUrl: string;
  fields: SigningField[];
  selectedFieldId?: string;
  readOnly?: boolean;
  showCrosshair?: boolean;
  toolBanner?: { label: string; sublabel: string } | null;
  onPageClick: (event: PageClickEvent) => void;
  onFieldMove: (id: string, x: number, y: number) => void;
  onFieldResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onFieldClick: (field: SigningField) => void;
  onFieldDoubleClick?: (field: SigningField) => void;
}

export default function DocumentViewer({ 
  fileUrl, fields, selectedFieldId, readOnly, showCrosshair, toolBanner,
  onPageClick, onFieldMove, onFieldResize, onFieldClick, onFieldDoubleClick, onPageCountChange, duplicatePreview,
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
  const didDragRef = useRef(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) { setNumPages(numPages); onPageCountChange?.(numPages); }

  // Emit normalized coordinates — viewer converts to storage units
  function handlePageClick(e: React.MouseEvent) {
    if (readOnly || dragging || resizing || !showCrosshair) return;
    if (didDragRef.current) { didDragRef.current = false; return; }
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect || !pageDims) { isProcessingRef.current = false; return; }

    // Convert click to storage-normalized coordinates
    const pixelX = (e.clientX - rect.left) / scale;
    const pixelY = (e.clientY - rect.top) / scale;
    const normX = pixelX / pageDims.width;
    const normY = pixelY / pageDims.height;
    const normW = 200 / pageDims.width;
    const normH = 50 / pageDims.height;

    onPageClick({
      x: Math.round(normX * 10000) / 10000,
      y: Math.round(normY * 10000) / 10000,
      page: currentPage,
      normalizedWidth: Math.round(normW * 10000) / 10000,
      normalizedHeight: Math.round(normH * 10000) / 10000,
    });

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

    // Convert field storage coords to pixel coords for interaction
    const px = pageDims ? field.x * pageDims.width : field.x;
    const py = pageDims ? field.y * pageDims.height : field.y;
    const pw = pageDims ? field.width * pageDims.width : field.width;
    const ph = pageDims ? field.height * pageDims.height : field.height;

    if (handle) {
      setResizing({ id: field.id, handle });
      setResizeStart({ x: px, y: py, w: pw, h: ph, mx, my });
    } else {
      didDragRef.current = false; setDragging(field.id);
      setDragOffset({ x: mx - px, y: my - py });
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

      didDragRef.current = true;
        if (dragging) {
        const px = mx - dragOffset.x;
        const py = my - dragOffset.y;
        // Convert back to normalized
        if (pageDims) {
          onFieldMove(dragging, Math.round(px / pageDims.width * 10000) / 10000, Math.round(py / pageDims.height * 10000) / 10000);
        }
      }

      if (resizing) {
        const dx = mx - resizeStart.mx;
        const dy = my - resizeStart.my;
        let newX = resizeStart.x;
        let newY = resizeStart.y;
        let newW = resizeStart.w;
        let newH = resizeStart.h;

        // Resize width
        if (resizing.handle.includes('e')) newW = Math.max(20, resizeStart.w + dx);
        if (resizing.handle.includes('w')) { newW = Math.max(20, resizeStart.w - dx); newX = resizeStart.x + dx; }

        // Resize height
        if (resizing.handle.includes('s')) newH = Math.max(20, resizeStart.h + dy);
        if (resizing.handle.includes('n')) { newH = Math.max(20, resizeStart.h - dy); newY = resizeStart.y + dy; }

        // Convert back to normalized
        if (pageDims) {
          onFieldResize(
            resizing.id,
            Math.round(newX / pageDims.width * 10000) / 10000,
            Math.round(newY / pageDims.height * 10000) / 10000,
            Math.round(newW / pageDims.width * 10000) / 10000,
            Math.round(newH / pageDims.height * 10000) / 10000
          );
        }
      }
    }

    function handleGlobalMouseUp() { setDragging(null); setResizing(null); }

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragging, resizing, dragOffset, resizeStart, scale, pageDims, onFieldMove, onFieldResize]);

  const pageFields = fields.filter(f => f.page === currentPage);

  return (
    <div className="space-y-4">
      {/* Tool banner */}
      {toolBanner && (
        <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-white font-medium">{toolBanner.label}</span>
            <span className="text-[10px] text-zinc-500">{toolBanner.sublabel}</span>
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
          style={{ position: 'relative', cursor: readOnly ? 'default' : showCrosshair ? 'crosshair' : 'default' }}
          onClick={handlePageClick}>
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="p-20 text-zinc-500">Loading...</div>}>
            <Page pageNumber={currentPage} scale={scale} renderTextLayer={false} renderAnnotationLayer={false}
              onLoadSuccess={(page: any) => { setPageDims({ width: page.originalWidth, height: page.originalHeight }); }} />
          </Document>
          
          {pageFields.map(field => {
            // Convert normalized storage coords to pixel coords for rendering
            const px = pageDims ? {
              x: field.x * pageDims.width,
              y: field.y * pageDims.height,
              width: field.width * pageDims.width,
              height: field.height * pageDims.height,
            } : { x: field.x, y: field.y, width: field.width, height: field.height };

            const isSelected = selectedFieldId === field.id;
            return (
              <div key={field.id}
                onMouseDown={(e) => handleFieldMouseDown(e, field)}
                onDoubleClick={(e) => handleFieldDoubleClick(e, field)}
                style={{
                  position: 'absolute', left: px.x, top: px.y, width: px.width, height: px.height,
                  cursor: readOnly ? 'pointer' : 'move', zIndex: isSelected ? 50 : dragging === field.id ? 40 : 10,
                  border: isSelected ? '2px solid rgba(255,255,255,0.8)' : field.value ? 'none' : '2px solid rgba(16,185,129,0.5)',
                  borderRadius: '6px', background: isSelected ? 'rgba(255,255,255,0.1)' : field.value ? 'transparent' : 'rgba(16,185,129,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                {field.value ? (
                  field.type === 'signature' || field.type === 'initial' || field.type === 'witness' ? (
                    <img src={field.value} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', mixBlendMode: 'multiply' }} />
                  ) : field.type === 'checkbox' ? (
                    <span className="text-lg text-emerald-400">✓</span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium">{field.value}</span>
                  )
                ) : (
                  <span className="text-xs text-emerald-300 font-medium select-none">
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
                    
          {/* Duplicate preview — follows cursor */}
          {duplicatePreview && (() => {
            const pp = pageDims ? {
              x: duplicatePreview.x * pageDims.width,
              y: duplicatePreview.y * pageDims.height,
              width: duplicatePreview.width * pageDims.width,
              height: duplicatePreview.height * pageDims.height,
            } : duplicatePreview;
            return (
              <div style={{
                position: 'absolute', left: pp.x, top: pp.y, width: pp.width, height: pp.height,
                border: '2px dashed rgba(255,255,255,0.5)', borderRadius: '6px',
                background: 'rgba(16,185,129,0.2)', opacity: 0.7, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
              }}>
                {duplicatePreview.value ? (
                  <img src={duplicatePreview.value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.6 }} />
                ) : (
                  <span className="text-xs text-emerald-300 font-medium">{duplicatePreview.type}</span>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

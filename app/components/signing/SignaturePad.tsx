'use client';

import { useState, useRef, useEffect } from 'react';
import { PenLine, Eraser, Check, X, Type, MousePointer } from 'lucide-react';

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function SignaturePad({ value, onChange, onClear, disabled = false }: SignaturePadProps) {
  const [mode, setMode] = useState<'type' | 'draw'>('type');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Set canvas size
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width || 600;
    const height = 200;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#ffffff';
    
    setCtx(context);
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || mode !== 'draw') return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (ctx) {
      ctx.closePath();
      // Save canvas data as signature
      const dataUrl = canvasRef.current?.toDataURL();
      if (dataUrl) {
        onChange(dataUrl);
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('type')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === 'type' 
              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          Type
        </button>
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === 'draw' 
              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <PenLine className="w-3.5 h-3.5" />
          Draw
        </button>
        {mode === 'draw' && (
          <button
            type="button"
            onClick={clearSignature}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Signature Input */}
      {mode === 'type' ? (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your full name"
            disabled={disabled}
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-sm outline-none focus:border-[var(--border-hover)] disabled:opacity-50"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            By typing your name, you agree to the terms of this agreement
          </p>
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] cursor-crosshair touch-none"
            style={{ height: '200px' }}
          />
          <div className="absolute bottom-2 left-2 text-xs text-[var(--text-muted)] bg-[var(--bg-primary)]/80 px-2 py-0.5 rounded">
            Draw your signature
          </div>
        </div>
      )}
    </div>
  );
}

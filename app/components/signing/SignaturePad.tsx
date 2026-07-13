'use client';

import { useState, useRef, useEffect } from 'react';
import { PenLine, Eraser, Type, Upload } from 'lucide-react';

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function SignaturePad({ value, onChange, onClear, disabled = false }: SignaturePadProps) {
  const [mode, setMode] = useState<'type' | 'draw' | 'upload'>('type');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.parentElement?.getBoundingClientRect();
    const width = rect?.width ? rect.width - 4 : 596;
    const height = 200;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
  }, []);

  useEffect(() => {
    if (!value || !value.startsWith('data:image')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = value;
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || mode !== 'draw') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
  };

  const drawMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || mode !== 'draw') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    onChange(canvas.toDataURL());
  };

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onClear();
    setUploadPreview(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadPreview(dataUrl);
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="flex gap-2 flex-wrap">
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
          onClick={() => {
            setMode('draw');
            setUploadPreview(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === 'draw' 
              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <PenLine className="w-3.5 h-3.5" />
          Draw
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            mode === 'upload' 
              ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        {(mode === 'draw' || mode === 'upload') && value && (
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Type Mode */}
      {mode === 'type' && (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your full name"
            disabled={disabled}
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-sm outline-none focus:border-[var(--border-hover)] disabled:opacity-50 text-[var(--text-primary)]"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1.5">
            By typing your name, you agree to the terms of this agreement
          </p>
        </div>
      )}

      {/* Draw Mode */}
      {mode === 'draw' && (
        <div className="relative border border-[var(--border-default)] rounded-xl overflow-hidden bg-white" style={{ minHeight: '200px' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={drawMove}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={drawMove}
            onTouchEnd={endDraw}
            className="w-full cursor-crosshair touch-none block"
            style={{ height: '200px', touchAction: 'none', backgroundColor: '#ffffff' }}
          />
          <div className="absolute bottom-2 left-2 text-xs text-gray-400 bg-white/90 px-2 py-0.5 rounded">
            Draw your signature
          </div>
          {!value && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-300">Sign here</p>
            </div>
          )}
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Upload Signature Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
              disabled={disabled}
            />
            <span className="text-xs text-[var(--text-muted)]">
              PNG, JPG, or WebP
            </span>
          </div>

          {uploadPreview && (
            <div className="mt-3 p-3 border border-[var(--border-default)] rounded-xl bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">Signature uploaded</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadPreview(null);
                    onClear();
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
              <img src={uploadPreview} alt="Uploaded signature" className="mt-2 max-h-16 object-contain" />
            </div>
          )}

          {!uploadPreview && (
            <div className="mt-3 p-6 border border-dashed border-[var(--border-default)] rounded-xl text-center bg-[var(--bg-secondary)]">
              <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--text-muted)]">Upload a signature image</p>
              <p className="text-xs text-[var(--text-muted)] opacity-60">PNG with transparent background recommended</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

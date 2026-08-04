'use client';

import { useRef, useState, useEffect } from 'react';
import { PenLine, Type, Upload } from 'lucide-react';

interface Props {
  value?: string;
  onChange: (data: string) => void;
  onClear: () => void;
  fieldType?: string;
}

type InputMode = 'draw' | 'type' | 'upload';

export default function SignaturePad({ value, onChange, onClear, fieldType }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<InputMode>('draw');
  const [typedText, setTypedText] = useState('');
  const [fontFamily, setFontFamily] = useState('Dancing Script');

  const fonts = ['Dancing Script', 'Homemade Apple', 'Caveat', 'Pacifico', 'Great Vibes'];

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    canvas.width = rect?.width || 400;
    canvas.height = 200;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#E5E5E5';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    if (value && !hasDrawn) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); setHasDrawn(true); };
      img.src = value;
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [value, mode]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    if (!isDrawing) return;
    setIsDrawing(false);
    exportCanvas();
  }

  function exportCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;
    exportCtx.drawImage(canvas, 0, 0);
    const imageData = exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) data[i + 3] = 0;
    }
    exportCtx.putImageData(imageData, 0, 0);
    onChange(exportCanvas.toDataURL('image/png'));
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasDrawn(false);
    setTypedText('');
    onClear();
  }

  function generateTypedSignature() {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = `48px "${fontFamily}", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedText, canvas.width / 2, canvas.height / 2);
    
    const exportCtx = canvas.getContext('2d');
    if (!exportCtx) return;
    const imageData = exportCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) data[i + 3] = 0;
    }
    exportCtx.putImageData(imageData, 0, 0);
    onChange(canvas.toDataURL('image/png'));
    setHasDrawn(true);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      setHasDrawn(true);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
        {([
          { key: 'draw' as InputMode, label: 'Draw', icon: PenLine },
          { key: 'type' as InputMode, label: 'Type', icon: Type },
          { key: 'upload' as InputMode, label: 'Upload', icon: Upload },
        ]).map(tab => (
          <button key={tab.key} onClick={() => { setMode(tab.key); setHasDrawn(false); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs transition-all ${mode === tab.key ? 'bg-white text-black font-medium' : 'text-zinc-400 hover:text-white'}`}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Draw mode */}
      {mode === 'draw' && (
        <div className="border-2 border-dashed border-white/[0.12] rounded-xl overflow-hidden">
          <canvas ref={canvasRef} className="w-full touch-none cursor-crosshair" style={{ height: 200, background: '#FFFFFF' }}
            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
            onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
        </div>
      )}

      {/* Type mode */}
      {mode === 'type' && (
        <div className="space-y-3">
          <input type="text" value={typedText} onChange={(e) => setTypedText(e.target.value)} placeholder="Type your signature"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-white/20" />
          <div className="flex flex-wrap gap-2">
            {fonts.map(font => (
              <button key={font} onClick={() => setFontFamily(font)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${fontFamily === font ? 'bg-white text-black' : 'border border-white/[0.08] text-zinc-400 hover:text-white'}`}
                style={{ fontFamily: `"${font}", cursive` }}>{font}</button>
            ))}
          </div>
          <div className="border rounded-xl p-4 bg-white flex items-center justify-center" style={{ height: 100 }}>
            <span style={{ fontFamily: `"${fontFamily}", cursive`, fontSize: 36, color: '#000' }}>{typedText || 'Preview'}</span>
          </div>
          <button onClick={generateTypedSignature} disabled={!typedText}
            className="w-full rounded-lg bg-white py-2 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-40">Apply</button>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition-all">
          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="sig-upload" />
          <label htmlFor="sig-upload" className="cursor-pointer">
            <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Upload signature image</p>
            <p className="text-xs text-zinc-600 mt-1">PNG or JPG with transparent background</p>
          </label>
        </div>
      )}

      {hasDrawn && (
        <button onClick={handleClear} className="w-full rounded-lg border border-white/[0.08] py-2 text-xs text-white hover:border-white/20">Clear</button>
      )}
    </div>
  );
}

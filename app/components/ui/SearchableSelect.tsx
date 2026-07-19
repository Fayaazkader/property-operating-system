'use client';

import { useState, useRef, useEffect } from 'react';

interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (id: string, label: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function SearchableSelect({ value, onChange, options, placeholder = 'Search...', className = '' }: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = search.length > 0 
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || o.sublabel?.toLowerCase().includes(search.toLowerCase()))
    : options.slice(0, 8);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        value={open ? search : (selected?.label || '')}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setSearch(''); }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/10 focus:ring-0"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/[0.08] rounded-lg overflow-hidden z-40 max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id, opt.label); setSearch(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              <span>{opt.label}</span>
              {opt.sublabel && <span className="text-[10px] text-zinc-600 ml-2">{opt.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '', onClear }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-white/20 transition-all"
      />
      {value && (
        <button
          onClick={() => { onChange(''); onClear?.(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
        >✕</button>
      )}
    </div>
  );
}

'use client';

import { useRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function DateInput({ value, onChange, placeholder = 'DD/MM/YYYY', required, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function formatDate(input: string): string {
    // Remove non-digits
    const digits = input.replace(/\D/g, '').slice(0, 8);
    
    // Auto-insert slashes
    if (digits.length >= 5) return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2, 4);
    if (digits.length >= 2) return digits.slice(0, 2) + '/';
    return digits;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    
    // Handle deletion — if user deletes a slash, remove the digit before it too
    if (raw.length < value.length) {
      const formatted = formatDate(raw.replace(/\//g, ''));
      onChange(formatted);
      return;
    }

    const formatted = formatDate(raw);
    onChange(formatted);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const pos = inputRef.current?.selectionStart || 0;
    
    // Arrow keys move past slashes
    if (e.key === 'ArrowRight' && value.charAt(pos) === '/') {
      e.preventDefault();
      inputRef.current?.setSelectionRange(pos + 1, pos + 1);
    }
    if (e.key === 'ArrowLeft' && pos > 0 && value.charAt(pos - 1) === '/') {
      e.preventDefault();
      inputRef.current?.setSelectionRange(pos - 1, pos - 1);
    }
    // Up/down arrows increment/decrement numbers
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      const parts = value.split('/');
      if (parts.length >= 3 && pos > 5) {
        // Edit year
        const year = parseInt(parts[2]) + delta;
        if (year > 2000 && year < 2100) {
          onChange(parts[0] + '/' + parts[1] + '/' + String(year));
        }
      } else if (parts.length >= 2 && pos > 2) {
        // Edit month
        const month = parseInt(parts[1]) + delta;
        if (month >= 1 && month <= 12) {
          onChange(parts[0] + '/' + String(month).padStart(2, '0') + (parts[2] ? '/' + parts[2] : ''));
        }
      } else {
        // Edit day
        const day = parseInt(parts[0]) + delta;
        if (day >= 1 && day <= 31) {
          const newDay = String(day).padStart(2, '0');
          onChange(newDay + (parts[1] ? '/' + parts[1] : '') + (parts[2] ? '/' + parts[2] : ''));
        }
      }
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={10}
      required={required}
      className={className}
    />
  );
}

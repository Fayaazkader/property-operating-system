'use client';

import { useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function DateInput({ value, onChange, placeholder = 'DD/MM/YYYY', required, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function formatDate(raw: string): string {
    // Remove all non-digits
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatDate(raw);
    onChange(formatted);
  }

  // Keep cursor in the right position after formatting
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    
    // After formatting, place cursor at the end
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    const input = inputRef.current;
    if (!input) return;
    const pos = input.selectionStart || 0;
    
    // Skip over slashes with arrow keys
    if (e.key === 'ArrowRight' && pos < value.length && value.charAt(pos) === '/') {
      e.preventDefault();
      input.setSelectionRange(pos + 1, pos + 1);
    }
    if (e.key === 'ArrowLeft' && pos > 0 && value.charAt(pos - 1) === '/') {
      e.preventDefault();
      input.setSelectionRange(pos - 1, pos - 1);
    }
    
    // Up/down arrows increment
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && value.length >= 10) {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      const parts = value.split('/');
      if (parts.length !== 3) return;
      
      let day = parseInt(parts[0]), month = parseInt(parts[1]), year = parseInt(parts[2]);
      
      if (pos > 5) year += delta;
      else if (pos > 2) month += delta;
      else day += delta;
      
      if (month < 1) month = 12;
      if (month > 12) month = 1;
      if (day < 1) day = 31;
      if (day > 31) day = 1;
      if (year < 2020) year = 2020;
      if (year > 2099) year = 2099;
      
      onChange(String(day).padStart(2, '0') + '/' + String(month).padStart(2, '0') + '/' + String(year));
    }
    
    // Backspace over slash removes the digit before it too
    if (e.key === 'Backspace' && pos > 0 && value.charAt(pos - 1) === '/') {
      e.preventDefault();
      const newVal = value.slice(0, pos - 2) + value.slice(pos);
      onChange(formatDate(newVal));
    }
    
    // Delete over slash removes the digit after it too
    if (e.key === 'Delete' && pos < value.length && value.charAt(pos) === '/') {
      e.preventDefault();
      const newVal = value.slice(0, pos) + value.slice(pos + 2);
      onChange(formatDate(newVal));
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

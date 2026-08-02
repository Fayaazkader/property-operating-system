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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value;
    
    // Remove any non-digit, non-slash characters
    val = val.replace(/[^\d/]/g, '');
    
    // Auto-insert slashes at the right positions
    const digits = val.replace(/\//g, '').slice(0, 8);
    
    if (digits.length >= 5) {
      val = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    } else if (digits.length >= 3) {
      val = digits.slice(0, 2) + '/' + digits.slice(2, 4);
    } else if (digits.length === 2 && !val.includes('/')) {
      val = digits + '/';
    }
    
    onChange(val);
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={10}
      required={required}
      className={className}
    />
  );
}

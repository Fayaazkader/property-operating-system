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

  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const raw = (e.target as HTMLInputElement).value;
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    
    let formatted = digits;
    if (digits.length >= 5) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    } else if (digits.length >= 3) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4);
    } else if (digits.length === 2) {
      formatted = digits + '/';
    }
    
    onChange(formatted);
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value}
      onInput={handleInput}
      placeholder={placeholder}
      
      required={required}
      className={className}
    />
  );
}

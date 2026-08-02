'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function CustomDropdown({
  options, value, onChange, placeholder = 'Select...', className = '', disabled = false, required = false,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    if (disabled) return;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setIsOpen(!isOpen);
  }

  return (
    <div className={className}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--border-hover)] flex items-center justify-between transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--border-hover)]'
        }`}
        disabled={disabled}
      >
        <span className={selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div ref={dropdownRef} style={dropdownStyle} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">No options available</div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { onChange(option.value); setIsOpen(false); }}
                  className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors ${
                    isSelected ? 'bg-[var(--bg-elevated)]' : ''
                  }`}
                >
                  <span className={isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{option.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

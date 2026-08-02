'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function DateInput({ value, onChange, placeholder = 'DD/MM/YYYY', required, className }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
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
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}

import { type InputHTMLAttributes } from 'react'

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  error?: string
}

export default function InputField({
  id,
  label,
  error,
  required,
  className = '',
  ...props
}: InputFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={id}
        required={required}
        className={`mt-1 w-full rounded-xl border bg-surface px-3 py-3 text-base text-ink placeholder:text-ink-sub transition-colors duration-150 focus:outline-none ${error ? 'border-red-400 focus:border-red-400' : 'border-edge focus:border-terra'} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

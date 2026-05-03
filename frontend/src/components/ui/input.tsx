import { cn } from '@/lib/utils'
import { forwardRef, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn('input-field', error && 'border-red-500/50', className)}
          {...props}
        />
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

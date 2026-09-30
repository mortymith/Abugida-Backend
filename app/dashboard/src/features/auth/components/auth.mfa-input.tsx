import { InputOTP, InputOTPGroup, InputOTPSlot } from '#/components/ui/input-otp'

interface MfaInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /**
   * Spec S-0.3 Keyboard & Focus: "On arrival focus is in the code input."
   * `InputOTP` renders a single hidden input, so the ref lands on the field the
   * user actually types into.
   */
  ref?: React.Ref<HTMLInputElement>
  /**
   * Spec Code Input Contract: `inputmode="numeric"`,
   * `autocomplete="one-time-code"` (so SMS autofill and password managers work),
   * `maxlength=6`, paste accepted, spaces stripped. `InputOTP` provides the
   * first three; `normaliseTotpCode` on the way in strips spaces.
   */
  invalid?: boolean
}

function MfaInput({ value, onChange, disabled, ref, invalid }: MfaInputProps) {
  return (
    <InputOTP
      ref={ref}
      id="mfa-code"
      maxLength={6}
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoComplete="one-time-code"
      inputMode="numeric"
      aria-label="6-digit verification code"
      aria-invalid={invalid ? true : undefined}
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }, (_, index) => (
          <InputOTPSlot key={index} index={index} className="size-11 text-base font-semibold" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}

export { MfaInput }

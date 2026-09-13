import { InputOTP, InputOTPGroup, InputOTPSlot } from '#/components/ui/input-otp'

interface MfaInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

function MfaInput({ value, onChange, disabled }: MfaInputProps) {
  return (
    <InputOTP
      id="mfa-code"
      maxLength={6}
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label="6-digit verification code"
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

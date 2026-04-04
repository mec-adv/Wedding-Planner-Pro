import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { displayPhoneBr, stripPhoneDigits } from "@/lib/phone-br";

export interface PhoneInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "defaultValue" | "onChange"> {
  /** Apenas dígitos, até 11 caracteres. */
  value: string;
  onDigitsChange: (digits: string) => void;
}

export function PhoneInput({ className, value, onDigitsChange, ...props }: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      className={cn(className)}
      value={displayPhoneBr(value)}
      onChange={(e) => onDigitsChange(stripPhoneDigits(e.target.value))}
    />
  );
}

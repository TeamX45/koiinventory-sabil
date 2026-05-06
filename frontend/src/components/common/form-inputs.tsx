import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ============================================
// CURRENCY INPUT (IDR)
// ============================================

const formatNumber = (val: number): string => {
  return new Intl.NumberFormat("id-ID").format(val);
};

const parseNumber = (val: string): number => {
  const cleaned = val.replace(/\D/g, "");
  return parseInt(cleaned, 10) || 0;
};

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function CurrencyInput({
  value,
  onChange,
  label,
  placeholder = "Rp 0",
  disabled,
  error,
  className,
}: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [editValue, setEditValue] = useState("");

  // When not focused, always show formatted value from prop
  // When focused, show the edit value
  const displayValue = isFocused ? editValue : (value ? formatNumber(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseNumber(raw);
    const formatted = formatNumber(parsed);
    setEditValue(formatted);
    onChange(parsed);
  };

  const handleFocus = () => {
    setEditValue(value ? formatNumber(value) : "");
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
          Rp
        </span>
        <Input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-9", error && "border-rose-500")}
        />
      </div>
      {error && <p className="text-[12px] text-rose-500">{error}</p>}
    </div>
  );
}

// ============================================
// PRICE SHORTCUT INPUT (terima "1.5 jt" / "350 rb")
// ============================================

import { parsePrice, formatRpShort } from "@/utils/format";

interface PriceShortcutInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PriceShortcutInput({
  value,
  onChange,
  placeholder = "mis. 1.5 jt atau 350 rb",
  disabled,
  className,
}: PriceShortcutInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const display = isFocused ? draft : (value ? formatRpShort(value) : "");

  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        inputMode="text"
        value={display}
        onFocus={() => {
          setDraft(value ? formatRpShort(value).replace(/\s/g, "") : "");
          setIsFocused(true);
        }}
        onBlur={() => {
          const parsed = parsePrice(draft);
          onChange(parsed);
          setIsFocused(false);
        }}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

// ============================================
// WEIGHT INPUT (GRAM)
// ============================================

interface WeightInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: "gram" | "kg";
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function WeightInput({
  value,
  onChange,
  label,
  unit = "gram",
  placeholder = "0",
  disabled,
  error,
  className,
}: WeightInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [editValue, setEditValue] = useState("");

  // When not focused, always show formatted value from prop
  // When focused, show the edit value
  const displayValue = isFocused ? editValue : (value ? formatNumber(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const parsed = parseInt(raw, 10) || 0;
    const formatted = formatNumber(parsed);
    setEditValue(formatted);
    onChange(parsed);
  };

  const handleFocus = () => {
    setEditValue(value ? formatNumber(value) : "");
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-14", error && "border-rose-500")}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
          {unit}
        </span>
      </div>
      {error && <p className="text-[12px] text-rose-500">{error}</p>}
    </div>
  );
}

// ============================================
// SEARCH SELECT
// ============================================

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";

interface SearchSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function SearchSelect({
  value,
  onChange,
  options,
  label,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyMessage = "Tidak ditemukan.",
  disabled,
  error,
  className,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              error && "border-rose-500"
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-[11px] text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-[12px] text-rose-500">{error}</p>}
    </div>
  );
}

// ============================================
// FORM FIELD WRAPPER
// ============================================

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  error,
  description,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
      {description && !error && (
        <p className="text-[12px] text-muted-foreground">{description}</p>
      )}
      {error && <p className="text-[12px] text-rose-500">{error}</p>}
    </div>
  );
}

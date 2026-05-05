/** Translate Laravel English validation messages → Indonesian */
const TRANSLATIONS: { match: RegExp; replace: string }[] = [
  { match: /has already been taken/i, replace: "sudah dipakai" },
  { match: /is required/i, replace: "wajib diisi" },
  { match: /must be a valid email/i, replace: "harus berupa email valid" },
  { match: /must be at least (\d+) characters/i, replace: "minimal $1 karakter" },
  { match: /must not be greater than (\d+) characters/i, replace: "maksimal $1 karakter" },
  { match: /must be a number/i, replace: "harus berupa angka" },
  { match: /must be a string/i, replace: "harus berupa teks" },
  { match: /must be a date/i, replace: "harus berupa tanggal" },
  { match: /must be at least (\d+)/i, replace: "minimal $1" },
  { match: /must not be greater than (\d+)/i, replace: "maksimal $1" },
  { match: /is invalid/i, replace: "tidak valid" },
  { match: /selected ([\w_]+) is invalid/i, replace: "$1 yang dipilih tidak valid" },
  { match: /the (\w+) field/gi, replace: "Field $1" },
];

/** Mapping nama field English → Indonesia */
const FIELD_NAMES: Record<string, string> = {
  code: "kode",
  name: "nama",
  email: "email",
  password: "kata sandi",
  phone: "telepon",
  role: "peran",
  supplier_id: "pemasok",
  pond_id: "kolam",
  total_count: "jumlah ekor",
  subtotal: "subtotal",
  purchase_date: "tanggal pembelian",
  harvest_date: "tanggal panen",
  count: "jumlah",
  cause: "penyebab",
  current_password: "kata sandi lama",
  new_password: "kata sandi baru",
};

function translateMessage(msg: string): string {
  let translated = msg;

  // Translate field references "the X" / "The X"
  translated = translated.replace(/[Tt]he (\w+)\b/g, (_, field: string) => {
    return FIELD_NAMES[field.toLowerCase()] ?? field;
  });

  // Apply phrase translations
  for (const { match, replace } of TRANSLATIONS) {
    translated = translated.replace(match, replace);
  }

  // Capitalize first letter
  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

/**
 * Extract user-friendly error message dari error axios.
 * Prioritas: error pertama dari validation errors > message > fallback.
 */
export function extractApiError(error: unknown, fallback = "Terjadi kesalahan."): string {
  const resp = (error as {
    response?: {
      status?: number;
      data?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };
  })?.response;

  // Laravel validation error (422)
  if (resp?.data?.errors) {
    const firstField = Object.keys(resp.data.errors)[0];
    const firstMsg = resp.data.errors[firstField]?.[0];
    if (firstMsg) return translateMessage(firstMsg);
  }

  if (resp?.data?.message) {
    return translateMessage(resp.data.message);
  }

  return fallback;
}

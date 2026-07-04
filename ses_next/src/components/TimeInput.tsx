"use client";

/** 手入力の時刻入力（HH:MM）。数字を打つと自動でコロンを挿入する。 */
export default function TimeInput({
  value,
  onChange,
  placeholder = "09:00",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  function handle(raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 4);
    let out = digits;
    if (digits.length >= 3) out = digits.slice(0, 2) + ":" + digits.slice(2);
    onChange(out);
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      className="field"
      placeholder={placeholder}
      maxLength={5}
      value={value}
      onChange={(e) => handle(e.target.value)}
    />
  );
}

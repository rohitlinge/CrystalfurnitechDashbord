import { parseVariantInput, formatVariantInput } from '../variants';

interface VariantTagInputProps {
  label: string;
  hint?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}

export default function VariantTagInput({
  label,
  hint,
  placeholder = 'Brown, Black, Grey',
  values,
  onChange,
}: VariantTagInputProps) {
  const handleBlur = (raw: string) => {
    onChange(parseVariantInput(raw));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-cf-muted uppercase tracking-wider">{label}</label>
      {hint && <p className="text-[10px] text-cf-muted">{hint}</p>}
      <input
        type="text"
        defaultValue={formatVariantInput(values)}
        key={values.join('|')}
        onBlur={(e) => handleBlur(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs p-3 bg-[#171717] border border-white/10 text-white rounded-lg focus:border-[#b65200] outline-none transition"
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#b65200]/15 text-[#d4af37] border border-[#d4af37]/25"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-cf-muted hover:text-white leading-none"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

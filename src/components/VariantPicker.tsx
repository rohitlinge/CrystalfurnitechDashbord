import { ProductVariantOptions, VariantSelections } from '../variants';

interface VariantPickerProps {
  options: ProductVariantOptions;
  selections: VariantSelections;
  onChange: (selections: VariantSelections) => void;
}

function OptionGroup({
  label,
  field,
  options,
  selected,
  onSelect,
}: {
  label: string;
  field: keyof VariantSelections;
  options: string[];
  selected?: string;
  onSelect: (field: keyof VariantSelections, value: string) => void;
}) {
  if (options.length === 0) return null;
  if (options.length === 1) {
    return (
      <div>
        <p className="text-[10px] font-bold text-cf-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xs text-white">{options[0]}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider mb-1.5">{label} *</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(field, opt)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
              selected === opt
                ? 'bg-gradient-to-r from-[#b65200] to-[#d66b0f] text-white border-transparent'
                : 'bg-[#171717] text-cf-secondary border-white/10 hover:border-[#d4af37]/40'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VariantPicker({ options, selections, onChange }: VariantPickerProps) {
  const handleSelect = (field: keyof VariantSelections, value: string) => {
    onChange({ ...selections, [field]: value });
  };

  const hasAny =
    options.colors.length > 0 ||
    options.fabrics.length > 0 ||
    options.woodFinishes.length > 0 ||
    options.sizes.length > 0;

  if (!hasAny) return null;

  return (
    <div className="space-y-3 bg-[#171717] rounded-lg p-3 border border-white/10">
      <p className="text-xs font-semibold text-white">Choose variants</p>
      <OptionGroup label="Color" field="color" options={options.colors} selected={selections.color} onSelect={handleSelect} />
      <OptionGroup label="Fabric" field="fabric" options={options.fabrics} selected={selections.fabric} onSelect={handleSelect} />
      <OptionGroup label="Wood Finish" field="woodFinish" options={options.woodFinishes} selected={selections.woodFinish} onSelect={handleSelect} />
      <OptionGroup label="Size" field="size" options={options.sizes} selected={selections.size} onSelect={handleSelect} />
    </div>
  );
}

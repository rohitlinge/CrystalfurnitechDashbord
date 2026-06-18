import { ProductItem, StockRequirement } from './types';

export interface VariantSelections {
  color?: string;
  fabric?: string;
  woodFinish?: string;
  size?: string;
}

export interface ProductVariantOptions {
  colors: string[];
  fabrics: string[];
  woodFinishes: string[];
  sizes: string[];
}

export function parseVariantInput(raw: string): string[] {
  return [...new Set(
    raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
  )];
}

export function formatVariantInput(values: string[] | undefined): string {
  return (values || []).join(', ');
}

export function getProductVariantOptions(product: ProductItem): ProductVariantOptions {
  return {
    colors: product.colorVariants?.length
      ? product.colorVariants
      : product.color
        ? [product.color]
        : [],
    fabrics: product.fabricVariants || [],
    woodFinishes: product.woodFinishVariants || [],
    sizes: product.sizeVariants?.length
      ? product.sizeVariants
      : product.size
        ? [product.size]
        : [],
  };
}

export function hasConfigurableVariants(product: ProductItem): boolean {
  const v = getProductVariantOptions(product);
  return v.colors.length > 1 || v.fabrics.length > 0 || v.woodFinishes.length > 0 || v.sizes.length > 1
    || (v.colors.length === 1 && (v.fabrics.length > 0 || v.woodFinishes.length > 0));
}

export function defaultVariantSelections(product: ProductItem): VariantSelections {
  const opts = getProductVariantOptions(product);
  return {
    color: opts.colors[0],
    fabric: opts.fabrics[0],
    woodFinish: opts.woodFinishes[0],
    size: opts.sizes[0],
  };
}

export function validateVariantSelections(
  product: ProductItem,
  selections: VariantSelections
): string | null {
  const opts = getProductVariantOptions(product);
  if (opts.colors.length > 0 && !selections.color) return 'Please select a color variant.';
  if (opts.fabrics.length > 0 && !selections.fabric) return 'Please select a fabric variant.';
  if (opts.woodFinishes.length > 0 && !selections.woodFinish) return 'Please select a wood finish variant.';
  if (opts.sizes.length > 0 && !selections.size) return 'Please select a size variant.';
  return null;
}

export function formatVariantSummary(selections: VariantSelections): string {
  const parts: string[] = [];
  if (selections.color) parts.push(`Color: ${selections.color}`);
  if (selections.fabric) parts.push(`Fabric: ${selections.fabric}`);
  if (selections.woodFinish) parts.push(`Wood: ${selections.woodFinish}`);
  if (selections.size) parts.push(`Size: ${selections.size}`);
  return parts.join(' · ');
}

export function formatVariantSummaryFromRequirement(req: StockRequirement): string {
  return formatVariantSummary({
    color: req.selectedColor,
    fabric: req.selectedFabric,
    woodFinish: req.selectedWoodFinish,
    size: req.selectedSize,
  });
}

export function formatProductVariantsPreview(product: ProductItem): string {
  const opts = getProductVariantOptions(product);
  const parts: string[] = [];
  if (opts.colors.length) parts.push(`${opts.colors.length} colors`);
  if (opts.fabrics.length) parts.push(`${opts.fabrics.length} fabrics`);
  if (opts.woodFinishes.length) parts.push(`${opts.woodFinishes.length} finishes`);
  if (opts.sizes.length) parts.push(`${opts.sizes.length} sizes`);
  return parts.join(' · ') || '';
}

export function productFieldsFromVariants(modal: {
  color: string;
  size: string;
  colorVariants: string[];
  fabricVariants: string[];
  woodFinishVariants: string[];
  sizeVariants: string[];
}): Pick<ProductItem, 'color' | 'size' | 'colorVariants' | 'fabricVariants' | 'woodFinishVariants' | 'sizeVariants'> {
  const colorVariants = modal.colorVariants.length ? modal.colorVariants : parseVariantInput(modal.color);
  const sizeVariants = modal.sizeVariants.length ? modal.sizeVariants : parseVariantInput(modal.size);
  return {
    colorVariants: colorVariants.length ? colorVariants : [],
    fabricVariants: modal.fabricVariants.length ? modal.fabricVariants : [],
    woodFinishVariants: modal.woodFinishVariants.length ? modal.woodFinishVariants : [],
    sizeVariants: sizeVariants.length ? sizeVariants : [],
    color: colorVariants[0] || modal.color || '',
    size: sizeVariants[0] || modal.size || '',
  };
}

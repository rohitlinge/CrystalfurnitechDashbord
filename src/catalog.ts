/** Wholesale PDF price list served from /public/PDF Catalog */
export const DEALER_PRICE_CATALOG = {
  label: 'PDF Catalog',
  title: 'Dealer Price List',
  description: 'Download the full Crystal Furnitech wholesale catalog with pricing.',
  /** Path under public/ — encoded at runtime for spaces */
  path: '/PDF Catalog/Crystal Catalogue Part - 03 (1).pdf',
  downloadFilename: 'Crystal-Furnitech-Price-Catalog.pdf',
} as const;

export function getDealerCatalogPdfUrl(): string {
  return encodeURI(DEALER_PRICE_CATALOG.path);
}

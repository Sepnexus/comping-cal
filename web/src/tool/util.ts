/** Loose address normaliser for client-side dedupe matching (mirrors server). */
export function normalizeLoose(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

export const SOURCE_LABEL: Record<string, string> = {
  mls_sold: 'MLS Sold',
  mls_active: 'MLS Active',
  mls_pending: 'MLS Pending',
  public_record: 'Public Rec',
};

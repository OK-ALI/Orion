export type CinemaBlockRuleClassification = "advertisement" | "tracker" | "popup";
export interface CinemaBlockRuleCatalogEntryV1 {
  id: string;
  host: string;
  includeSubdomains: boolean;
  classification: CinemaBlockRuleClassification;
}
export const CINEMA_BLOCK_RULE_CATALOG_V1: readonly CinemaBlockRuleCatalogEntryV1[];
export function toElectronBlockedPatterns(catalog?: readonly CinemaBlockRuleCatalogEntryV1[]): string[];

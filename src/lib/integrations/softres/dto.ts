// Raw softres.it API shapes (https://softres.it/api/raid/{raidId}). These stay
// inside the adapter; the mapper converts them to domain types. Shapes derived
// from the recorded fixture in tests/fixtures/softres/raid.json.

// GET /api/raid/{raidId}
export interface SoftresRaidDto {
  raidId: string;
  edition: string;
  /** True when the sheet requires Discord login (so reserves carry `dId`). */
  discord: boolean;
  reserved: SoftresReserveDto[];
  /** Short instance keys, e.g. ["kara"], ["ssc"], ["tk"]. */
  instances: string[];
}

export interface SoftresReserveDto {
  /** Character name as typed by the reserver. */
  name: string;
  /** WoW class string. */
  class: string;
  /** Numeric spec id (softres-internal) — NOT a spec name. */
  spec: number;
  /** Reserved item ids. */
  items: number[];
  note: string;
  created: string;
  updated: string;
  /** Reserver's Discord id. Present when `discord` is true; "0"/absent otherwise. */
  dId?: string;
  /** Reserver's Discord username (e.g. "skreamo#0"). */
  dU?: string;
}

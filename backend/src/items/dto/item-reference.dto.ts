export class ItemReference {
  lastUpdated!: Date;
  basePrice!: number;
  quantity!: number;
  observedAt!: Date;
}

// base_price and quantity are NOT NULL in item_reference, so unlike the joined
// columns on ItemRow these are never null.
export interface ItemReferenceRow {
  last_updated: Date;
  base_price: number;
  quantity: number;
  observed_at: Date;
}
export class Listing {
  id!: string;
  createdAt!: Date;
  listingType!: string;
  price!: number | null;
  floatValue!: number | null;
  paintSeed!: number | null;
  predictedPrice!: number | null;
}

export interface ListingRow {
  id: string;
  created_at: Date;
  listing_type: string;
  price: number | null;
  float_value: number | null;
  paint_seed: number | null;
  predicted_price: number | null;
}

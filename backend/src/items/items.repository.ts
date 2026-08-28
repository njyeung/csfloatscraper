import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

interface ItemRow {
  market_hash_name: string;
  item_name: string;
  type: string;
  rarity_name: string;
  wear_name: string | null;
  collection: string | null;
  is_stattrak: boolean | null;
  base_price: number | null;
  quantity: number | null;
}

interface ListingRow {
  id: string;
  created_at: Date;
  listing_type: string;
  price: number | null;
  float_value: number | null;
  paint_seed: number | null;
  predicted_price: number | null;
}

export interface Item {
  marketHashName: string;
  itemName: string;
  type: string;
  rarityName: string;
  wearName: string | null;
  collection: string | null;
  isStatTrak: boolean | null;
  basePrice: number | null;
  quantity: number | null;
}

export interface Listing {
  id: string;
  createdAt: Date;
  listingType: string;
  price: number | null;
  floatValue: number | null;
  paintSeed: number | null;
  predictedPrice: number | null;
}

// base_price and quantity are NOT NULL in item_reference, so unlike the joined
// columns on ItemRow these are never null.
interface ItemReferenceRow {
  last_updated: Date;
  base_price: number;
  quantity: number;
  observed_at: Date;
}

export interface ItemReference {
  lastUpdated: Date;
  basePrice: number;
  quantity: number;
  observedAt: Date;
}

function toItem(row: ItemRow): Item {
  return {
    marketHashName: row.market_hash_name,
    itemName: row.item_name,
    type: row.type,
    rarityName: row.rarity_name,
    wearName: row.wear_name,
    collection: row.collection,
    isStatTrak: row.is_stattrak,
    basePrice: row.base_price,
    quantity: row.quantity,
  };
}

function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    createdAt: row.created_at,
    listingType: row.listing_type,
    price: row.price,
    floatValue: row.float_value,
    paintSeed: row.paint_seed,
    predictedPrice: row.predicted_price,
  };
}

function toItemReference(row: ItemReferenceRow): ItemReference {
  return {
    lastUpdated: row.last_updated,
    basePrice: row.base_price,
    quantity: row.quantity,
    observedAt: row.observed_at,
  };
}


@Injectable()
export class ItemsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async search(params: {
    type?: string;
    search?: string;
    limit: number;
  }): Promise<Item[]> {
    const { rows } = await this.pool.query<ItemRow>(
      `SELECT i.market_hash_name,
              i.item_name,
              i.type,
              i.rarity_name,
              i.wear_name,
              i.collection,
              i.is_stattrak,
              r.base_price,
              r.quantity
         FROM items i
         LEFT JOIN LATERAL (
              SELECT base_price, quantity
                FROM item_reference
               WHERE market_hash_name = i.market_hash_name
               ORDER BY last_updated DESC
               LIMIT 1
         ) r ON TRUE
        WHERE ($1::text IS NULL OR i.type = $1)
          AND ($2::text IS NULL OR i.market_hash_name ILIKE '%' || $2 || '%')
        ORDER BY i.market_hash_name
        LIMIT $3`,
      [params.type ?? null, params.search ?? null, params.limit],
    );

    return rows.map(toItem);
  }

  async recentListings(
    marketHashName: string,
    limit: number,
  ): Promise<Listing[]> {
    const { rows } = await this.pool.query<ListingRow>(
      `SELECT id, created_at, listing_type, price, float_value, paint_seed, predicted_price
         FROM listings
        WHERE market_hash_name = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [marketHashName, limit],
    );

    return rows.map(toListing);
  }

  // item_reference is append-only: one row each time CSFloat's base price or
  // quantity moved, newest first.
  async referenceHistory(
    marketHashName: string,
    limit: number,
  ): Promise<ItemReference[]> {
    const { rows } = await this.pool.query<ItemReferenceRow>(
      `SELECT last_updated, base_price, quantity, observed_at
         FROM item_reference
        WHERE market_hash_name = $1
        ORDER BY last_updated DESC
        LIMIT $2`,
      [marketHashName, limit],
    );

    return rows.map(toItemReference);
  }

  async exists(marketHashName: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM items WHERE market_hash_name = $1`,
      [marketHashName],
    );
    return rowCount === 1;
  }
}
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { Item, ItemRow } from './dto/item.dto';
import { Listing, ListingRow } from './dto/listing.dto';
import { ItemReference, ItemReferenceRow } from './dto/item-reference.dto';

function toItem(row: ItemRow): Item {
  return {
    marketHashName: row.market_hash_name,
    itemName: row.item_name,
    paintIndex: row.paint_index,
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

  async search(search: string, limit: number): Promise<Item[]> {
    const { rows } = await this.pool.query<ItemRow>(
      `SELECT i.market_hash_name,
              i.item_name,
              i.paint_index,
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
        WHERE ($1::text IS NULL OR i.market_hash_name ILIKE '%' || $1 || '%')
        ORDER BY i.market_hash_name
        LIMIT $2`,
      [search, limit],
    );

    return rows.map(toItem);
  }

  async recentListings(marketHashName: string, limit: number = 20): Promise<Listing[]> {
    const { rows } = await this.pool.query<ListingRow>(
      `SELECT id, 
              created_at, 
              listing_type, 
              price, 
              float_value, 
              paint_seed, 
              predicted_price
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
  async referenceHistory(marketHashName: string, limit: number): Promise<ItemReference[]> {
    const { rows } = await this.pool.query<ItemReferenceRow>(
      `SELECT last_updated,
              paint_index 
              base_price, 
              quantity, 
              observed_at
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
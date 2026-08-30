export class Item {
  marketHashName!: string;
  itemName!: string;
  paintIndex!: number;
  type!: string;
  rarityName!: string;
  wearName!: string | null;
  collection!: string | null;
  isStatTrak!: boolean | null;
  basePrice!: number | null;
  quantity!: number | null;
}

export interface ItemRow {
  market_hash_name: string;
  item_name: string;
  paint_index: number;
  type: string;
  rarity_name: string;
  wear_name: string | null;
  collection: string | null;
  is_stattrak: boolean | null;
  base_price: number | null;
  quantity: number | null;
}
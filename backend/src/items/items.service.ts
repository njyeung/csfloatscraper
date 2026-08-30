import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemsRepository } from './items.repository';
import { Item } from './dto/item.dto';
import { Listing } from './dto/listing.dto';
import { ItemReference } from './dto/item-reference.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly items: ItemsRepository) {}

  search(search: string, limit: number): Promise<Item[]> {
    return this.items.search(search, limit);
  }

  async recentListings(
    marketHashName: string,
    limit: number,
  ): Promise<Listing[]> {
    if (!(await this.items.exists(marketHashName))) {
      throw new NotFoundException(`No item named "${marketHashName}"`);
    }

    return this.items.recentListings(marketHashName, limit);
  }

  async referenceHistory(marketHashName: string, limit: number): Promise<ItemReference[]> {
    if (!(await this.items.exists(marketHashName))) {
      throw new NotFoundException(`No item named "${marketHashName}"`);
    }
    
    return this.items.referenceHistory(marketHashName, limit);
  }
}

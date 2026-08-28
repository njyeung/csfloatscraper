import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { Item } from './dto/item.dto';
import { Listing } from './dto/listing.dto';
import { ItemReference } from './dto/item-reference.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  search(
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<Item[]> {
    return this.items.search({ type, search, limit: clamp(limit) });
  }

  // market_hash_name contains spaces and pipes ("AK-47 | Redline (Field-Tested)"),
  // so it rides in the query string rather than the path.
  @Get('listings')
  listings(
    @Query('name') name: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<Listing[]> {
    return this.items.recentListings(name, clamp(limit));
  }

  @Get('reference')
  reference(
    @Query('name') name: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<ItemReference[]> {
    return this.items.referenceHistory(name, clamp(limit));
  }
}

function clamp(limit: number): number {
  return Math.min(Math.max(limit, 1), 100);
}

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import time
import os
import sys

import psycopg
from dotenv import load_dotenv

load_dotenv()

class Listing:
    def __init__(self, dict):
        self.id = int(dict["id"])
        self.created_at = dict["created_at"]
        self.listing_type = dict["type"]
        self.price = dict["price"] if self.listing_type == "buy_now" else None

        self.def_index = dict["item"]["def_index"]
        self.market_hash_name = dict["item"]["market_hash_name"]
        self.item_name = dict["item"]["item_name"]
        self.rarity = dict["item"]["rarity"]
        self.rarity_name = dict["item"]["rarity_name"]
        self.type = dict["item"]["type"]
        self.asset_id = int(dict["item"]["asset_id"])

        self.quality = dict["item"].get("quality")
        self.paint_index = dict["item"].get("paint_index", None)
        self.paint_seed = dict["item"].get("paint_seed", None)
        self.float_value = dict["item"].get("float_value", None)
        self.is_stattrak = dict["item"].get("is_stattrak", None)
        self.is_souvenir = dict["item"].get("is_souvenir", None)
        self.wear_name = dict["item"].get("wear_name", None)
        self.collection = dict["item"].get("collection", None)
        self.serialized_inspect = dict["item"].get("serialized_inspect", None)

        # charms
        self.keychain_index =  dict["item"].get("keychain_index", None)

        reference = dict.get("reference") or {}

        self.base_price = reference.get("base_price", None)
        self.predicted_price = reference.get("predicted_price", None)
        self.last_updated = reference.get("last_updated", None)
        self.quantity = reference.get("quantity", None) # num of this item listed on CSFloat rn

        self.has_reference_block = (self.base_price is not None
                                    and self.quantity is not None
                                    and self.last_updated is not None)

    def __repr__(self):
        return f"""LISTING FOR {self.market_hash_name}:
            Created at: {self.created_at}
            Price: {self.price}
            Rarity: {self.rarity}
            Rarity Name: {self.rarity_name}
            Type: {self.type}

            Float: {self.float_value}
            Wear: {self.wear_name}
            Stattrak: {self.is_stattrak}
            Souvenir: {self.is_souvenir}
            Collection: {self.collection}
            Paint index: {self.paint_index}
            Paint Seed: {self.paint_seed}

            Base price: {self.base_price}
            Predicted price: {self.predicted_price}
            Last Updated: {self.last_updated}
            Quantity: {self.quantity}
        """
    

class DB:
    def __init__(self):
        self.dsn = os.environ.get("DATABASE_URL")
        if not self.dsn:
            sys.exit("DATABASE_URL not set.")

        self.ITEM_SQL = """
        INSERT INTO items (market_hash_name, def_index, item_name, rarity, rarity_name, type,
                        quality, paint_index, wear_name, collection, is_stattrak, is_souvenir)
        VALUES (%(market_hash_name)s, %(def_index)s, %(item_name)s, %(rarity)s, %(rarity_name)s, %(type)s,
                %(quality)s, %(paint_index)s, %(wear_name)s, %(collection)s, %(is_stattrak)s, %(is_souvenir)s)
        ON CONFLICT (market_hash_name) DO NOTHING
        """

        self.REFERENCE_SQL = """
        INSERT INTO item_reference (market_hash_name, last_updated, base_price, quantity)
        SELECT %(market_hash_name)s, %(last_updated)s, %(base_price)s, %(quantity)s
        WHERE NOT EXISTS (
            SELECT 1 FROM (
                SELECT base_price, quantity, last_updated FROM item_reference
                WHERE market_hash_name = %(market_hash_name)s
                ORDER BY last_updated DESC LIMIT 1
            ) prev
            WHERE prev.last_updated >= %(last_updated)s
            OR (prev.base_price = %(base_price)s AND prev.quantity = %(quantity)s)
        )
        """

        self.LISTING_SQL = """
        INSERT INTO listings (id, created_at, listing_type, price, market_hash_name, asset_id,
                            paint_seed, float_value, serialized_inspect, keychain_index,
                            base_price, predicted_price, reference_updated)
        VALUES (%(id)s, %(created_at)s, %(listing_type)s, %(price)s, %(market_hash_name)s, %(asset_id)s,
                %(paint_seed)s, %(float_value)s, %(serialized_inspect)s, %(keychain_index)s,
                %(base_price)s, %(predicted_price)s, %(last_updated)s)
        ON CONFLICT (id) DO NOTHING
        """

        self.conn = None
        self.connect()

    def connect(self):
        self.conn = psycopg.connect(
            self.dsn,
            autocommit = True,
            keepalives = 1,
            keepalives_idle = 30,
            keepalives_interval = 10,
            keepalives_count = 5,
        )

    def close(self):
        if self.conn is not None and not self.conn.closed:
            self.conn.close()
        self.conn = None

    def insert_listing(self, listing):
        try:
            if self.conn is None or self.conn.closed:
                self.connect()

            with self.conn.transaction():
                params = vars(listing)
                
                self.conn.execute(self.ITEM_SQL, params) # discover new items

                if listing.has_reference_block:
                    self.conn.execute(self.REFERENCE_SQL, params) # update base/predicted price
                
                cur = self.conn.execute(self.LISTING_SQL, params) # insert row
                
                if cur.rowcount != 1:
                    return False

        except psycopg.OperationalError as e:
            # OperationalError is the "connection is broken" family and covers
            # AdminShutdown (db restarted) and CannotConnectNow (db still booting).
            print(f"db unreachable ({type(e).__name__}), dropped listing")
            self.close()
            return None

        return True

class API:
    def __init__(self):
        self.API = "https://csfloat.com/api/v1/listings"
        self.session = requests.Session()
        self.session.headers["Authorization"] = os.environ.get("CSFLOAT_API_KEY")

        retry = Retry(
            total = 3,
            backoff_factor = 1, # sleeps 1s, 2s, 4s
            status_forcelist = [500, 502, 503, 504],
            allowed_methods = ["GET"],
        )
        self.session.mount("https://", HTTPAdapter(max_retries = retry))

    def get(self):
        r = self.session.get(
            self.API,
            params = {"sort_by": "most_recent"},
            timeout = (5, 30),
        )
        status = r.status_code
        body = r.json()
        return (status, body)

def main():
    api = API()
    db = DB()
    while True:
        try:
            status, body = api.get()
            if status != 200:
                print(f"api returned {status}, backing off")
                time.sleep(20)
                continue

            for o in body["data"]:
                listing = Listing(o)
                print(listing)
                db.insert_listing(listing)

            time.sleep(20)

        except Exception:
            print(f"api request iteration failed, skipping a cycle")
            time.sleep(20)
            continue

        

if __name__ == "__main__":
    main()

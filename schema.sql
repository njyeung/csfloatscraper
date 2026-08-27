-- cs2market schema
--
-- Three tables:
--   items           one row per market_hash_name; the attributes that never change
--   item_reference  CSFloat's moving base price per item, appended only when it moves
--   listings        one row per listing id, immutable once written
--
-- All money is integer USD cents, exactly as the API sends it.

BEGIN;

CREATE TABLE items (
    market_hash_name TEXT PRIMARY KEY,

    def_index        INTEGER NOT NULL,   -- 7 for AK
    item_name        TEXT    NOT NULL,
    rarity           SMALLINT NOT NULL,
    rarity_name      TEXT    NOT NULL,
    type             TEXT    NOT NULL,   -- skin | sticker | container | agent | music_kit | charm

    quality          SMALLINT,
    paint_index      INTEGER,
    wear_name        TEXT,               -- Factory New .. Battle-Scarred
    collection       TEXT,
    is_stattrak      BOOLEAN,
    is_souvenir      BOOLEAN,

    first_seen       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX items_type_idx        ON items (type);
CREATE INDEX items_collection_idx  ON items (collection) WHERE collection IS NOT NULL;
CREATE INDEX items_paint_index_idx ON items (paint_index) WHERE paint_index IS NOT NULL;


CREATE TABLE item_reference (
    market_hash_name TEXT NOT NULL REFERENCES items (market_hash_name),
    last_updated     TIMESTAMPTZ NOT NULL,

    base_price       INTEGER NOT NULL,
    quantity         INTEGER NOT NULL,

    observed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (market_hash_name, last_updated)
);

CREATE TABLE listings (
    id                 BIGINT PRIMARY KEY,
    created_at         TIMESTAMPTZ NOT NULL,
    
    listing_type       TEXT NOT NULL, -- buy_now | auction.
    price              INTEGER,

    market_hash_name   TEXT NOT NULL REFERENCES items (market_hash_name),
    asset_id           BIGINT NOT NULL, -- steam inventory id (unique to each instance of a skin)

    -- unique item attributes (everything else is on items)
    paint_seed         INTEGER,
    float_value        DOUBLE PRECISION,
    serialized_inspect TEXT,
    keychain_index     INTEGER,

    -- reference block (duplicate fields).
    base_price         INTEGER,
    predicted_price    INTEGER,
    reference_updated  TIMESTAMPTZ,

    ingested_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listings_item_created_idx ON listings (market_hash_name, created_at DESC);
CREATE INDEX listings_created_idx ON listings (created_at DESC);
CREATE INDEX listings_asset_idx ON listings (asset_id);

COMMIT;

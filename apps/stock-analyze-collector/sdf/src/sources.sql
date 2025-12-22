-- 外部データソース定義
CREATE TABLE stock_list_raw 
WITH (
    type = 'json',
    location = '../../../data/master/stock_list.ndjson' 
);

CREATE TABLE prices_raw
WITH (
    type = 'parquet',
    location = '../../../data/processed/prices/**/*.parquet'
);

CREATE TABLE fundamentals_raw
WITH (
    type = 'parquet',
    location = '../../../data/processed/fundamentals/**/*.parquet'
);

CREATE TABLE edinet_raw
WITH (
    type = 'json',
    location = '../../../data/raw/edinet/**/*.json'
);

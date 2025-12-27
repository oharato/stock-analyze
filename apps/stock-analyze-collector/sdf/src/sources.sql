-- 外部データソース定義
CREATE TABLE stock_list_raw (
    code varchar,
    name varchar,
    market varchar,
    sector33 varchar,
    sector17 varchar,
    scale varchar
)
WITH (
    type = 'json',
    location = '../../../data/master/stock_list.ndjson' 
);

CREATE TABLE prices_raw (
    date bigint,
    code varchar,
    open double,
    high double,
    low double,
    close double,
    adjClose double,
    volume bigint
)
WITH (
    format = 'parquet',
    location = '../../../data/processed/prices'
);

CREATE TABLE fundamentals_raw (
    code varchar,
    year varchar,
    "総資産" varchar,
    "純資産" varchar,
    "株主資本" varchar,
    "利益剰余金" varchar,
    "短期借入金" varchar,
    "長期借入金" varchar,
    "BPS" varchar,
    "自己資本比率" varchar,
    "営業CF" varchar,
    "投資CF" varchar,
    "財務CF" varchar,
    "設備投資" varchar,
    "現金同等物" varchar,
    "営業CFマージン" varchar,
    "売上高" varchar,
    "営業利益" varchar,
    "経常利益" varchar,
    "純利益" varchar,
    "EPS" varchar,
    "ROE" varchar,
    "ROA" varchar,
    "一株配当" varchar,
    "剰余金の配当" varchar,
    "自社株買い" varchar,
    "配当性向" varchar,
    "総還元性向" varchar,
    "純資産配当率" varchar
)
WITH (
    format = 'parquet',
    location = '../../../data/processed/fundamentals'
);

CREATE TABLE edinet_raw (
    doc_id varchar,
    filer_name varchar,
    ticker varchar,
    submit_date varchar,
    year bigint,
    business_policy varchar,
    business_policy_vector array<double>,
    business_risks varchar,
    business_risks_vector array<double>,
    mda varchar,
    mda_vector array<double>,
    business_description varchar,
    business_description_vector array<double>,
    company_history varchar,
    company_history_vector array<double>,
    research_and_development varchar,
    research_and_development_vector array<double>,
    corporate_governance varchar,
    corporate_governance_vector array<double>,
    net_sales double,
    operating_income double,
    ordinary_income double,
    net_income double,
    net_assets double,
    total_assets double,
    earnings_per_share double,
    book_value_per_share double,
    equity_to_total_assets_ratio double,
    rate_of_return_on_equity double
)
WITH (
    type = 'json',
    location = '../../../data/raw/edinet'
);

CREATE TABLE large_shareholdings_raw (
    doc_id varchar,
    submit_date varchar,
    filer_name varchar,
    ticker varchar,
    doc_description varchar,
    doc_type_code varchar,
    holding_purpose varchar,
    holding_ratio double,
    prev_holding_ratio double,
    total_shares_held bigint
)
WITH (
    type = 'json',
    location = '../../../data/raw/large-shareholdings'
);

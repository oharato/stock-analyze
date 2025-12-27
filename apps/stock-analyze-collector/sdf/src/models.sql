-- データモデル、変換定義
CREATE TABLE companies AS SELECT * FROM stock_list_raw;

CREATE TABLE prices AS 
SELECT * FROM prices_raw;

CREATE TABLE fundamentals AS 
SELECT * FROM fundamentals_raw;

CREATE TABLE edinet AS 
SELECT 
    ticker as code,
    year,
    submit_date as date,
    doc_id,
    business_risks,
    business_risks_vector,
    mda,
    mda_vector,
    corporate_governance,
    corporate_governance_vector,
    research_and_development,
    research_and_development_vector,
    net_sales,
    operating_income,
    ordinary_income,
    net_income,
    net_assets,
    total_assets,
    earnings_per_share,
    book_value_per_share,
    equity_to_total_assets_ratio,
    rate_of_return_on_equity
FROM edinet_raw;

CREATE TABLE large_shareholdings AS
SELECT
    doc_id,
    submit_date as date,
    filer_name,
    ticker as code,
    doc_description,
    doc_type_code,
    holding_purpose,
    holding_ratio,
    prev_holding_ratio,
    total_shares_held
FROM large_shareholdings_raw;

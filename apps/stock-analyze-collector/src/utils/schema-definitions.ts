
import parquetjs from 'parquetjs';
const { ParquetSchema } = parquetjs;

export const STOCK_LIST_SCHEMA = new ParquetSchema({
    code: { type: 'UTF8' },
    name: { type: 'UTF8' },
    market: { type: 'UTF8' },
    sector33: { type: 'UTF8', optional: true },
    sector17: { type: 'UTF8', optional: true },
    scale: { type: 'UTF8', optional: true }
});

export const RAW_DATA_SCHEMA = new ParquetSchema({
    content: { type: 'UTF8' }
});

export const LARGE_SHAREHOLDING_SCHEMA = new ParquetSchema({
    doc_id: { type: 'UTF8' },
    submit_date: { type: 'UTF8' },
    filer_name: { type: 'UTF8', optional: true },
    ticker: { type: 'UTF8' },
    doc_description: { type: 'UTF8', optional: true },
    doc_type_code: { type: 'UTF8', optional: true },
    holding_purpose: { type: 'UTF8', optional: true },
    holding_ratio: { type: 'DOUBLE', optional: true },
    prev_holding_ratio: { type: 'DOUBLE', optional: true },
    total_shares_held: { type: 'DOUBLE', optional: true }
});

export const EDINET_SCHEMA = new ParquetSchema({
    doc_id: { type: 'UTF8' },
    filer_name: { type: 'UTF8', optional: true },
    edinet_code: { type: 'UTF8', optional: true },
    doc_description: { type: 'UTF8', optional: true },
    submit_date: { type: 'UTF8', optional: true },
    ticker: { type: 'UTF8' },
    year: { type: 'INT64' },

    // Qualitative
    business_policy: { type: 'UTF8', optional: true },
    business_policy_vector: { type: 'DOUBLE', repeated: true, optional: true },
    business_risks: { type: 'UTF8', optional: true },
    business_risks_vector: { type: 'DOUBLE', repeated: true, optional: true },
    mda: { type: 'UTF8', optional: true },
    mda_vector: { type: 'DOUBLE', repeated: true, optional: true },
    business_description: { type: 'UTF8', optional: true },
    business_description_vector: { type: 'DOUBLE', repeated: true, optional: true },
    company_history: { type: 'UTF8', optional: true },
    company_history_vector: { type: 'DOUBLE', repeated: true, optional: true },
    research_and_development: { type: 'UTF8', optional: true },
    research_and_development_vector: { type: 'DOUBLE', repeated: true, optional: true },
    corporate_governance: { type: 'UTF8', optional: true },
    corporate_governance_vector: { type: 'DOUBLE', repeated: true, optional: true },

    // Quantitative
    net_sales: { type: 'DOUBLE', optional: true },
    operating_income: { type: 'DOUBLE', optional: true },
    ordinary_income: { type: 'DOUBLE', optional: true },
    net_income: { type: 'DOUBLE', optional: true },
    net_assets: { type: 'DOUBLE', optional: true },
    total_assets: { type: 'DOUBLE', optional: true },
    operating_cash_flow: { type: 'DOUBLE', optional: true },
    investing_cash_flow: { type: 'DOUBLE', optional: true },
    financing_cash_flow: { type: 'DOUBLE', optional: true },
    cash_and_equivalents: { type: 'DOUBLE', optional: true },
    earnings_per_share: { type: 'DOUBLE', optional: true },
    book_value_per_share: { type: 'DOUBLE', optional: true },
    equity_to_total_assets_ratio: { type: 'DOUBLE', optional: true },
    rate_of_return_on_equity: { type: 'DOUBLE', optional: true },
    price_earnings_ratio: { type: 'DOUBLE', optional: true },
    payout_ratio: { type: 'DOUBLE', optional: true },
    number_of_issued_shares: { type: 'DOUBLE', optional: true },
    dividend_paid_per_share: { type: 'DOUBLE', optional: true },

    // Expanded
    shareholders_equity: { type: 'DOUBLE', optional: true },
    retained_earnings: { type: 'DOUBLE', optional: true },
    short_term_loans: { type: 'DOUBLE', optional: true },
    long_term_loans: { type: 'DOUBLE', optional: true },
    capex: { type: 'DOUBLE', optional: true },
    dividend_total: { type: 'DOUBLE', optional: true },
    buybacks: { type: 'DOUBLE', optional: true },
    roa: { type: 'DOUBLE', optional: true },
    ocf_margin: { type: 'DOUBLE', optional: true },
    total_payout_ratio: { type: 'DOUBLE', optional: true },
    doe: { type: 'DOUBLE', optional: true },

    // Complex types (JSON stringified for now as ParquetJS struct support is tricky or we can flat them if needed, but JSON is safer for variable schema)
    // Actually ParquetJS doesn't support JSON type. We must use UTF8 and stringify.
    major_shareholders: { type: 'UTF8', optional: true },

    // Extra
    date: { type: 'UTF8', optional: true },
    docId: { type: 'UTF8', optional: true }
});

export const FUNDAMENTAL_SCHEMA = new ParquetSchema({
    code: { type: 'UTF8' },
    year: { type: 'UTF8' },
    年度: { type: 'UTF8', optional: true },
    売上高: { type: 'DOUBLE', optional: true },
    営業利益: { type: 'DOUBLE', optional: true },
    経常利益: { type: 'DOUBLE', optional: true },
    純利益: { type: 'DOUBLE', optional: true },
    純資産: { type: 'DOUBLE', optional: true },
    総資産: { type: 'DOUBLE', optional: true },
    EPS: { type: 'DOUBLE', optional: true },
    BPS: { type: 'DOUBLE', optional: true },
    ROE: { type: 'DOUBLE', optional: true },
    自己資本比率: { type: 'DOUBLE', optional: true },
    営業CF: { type: 'DOUBLE', optional: true },
    投資CF: { type: 'DOUBLE', optional: true },
    財務CF: { type: 'DOUBLE', optional: true },
    現金同等物: { type: 'DOUBLE', optional: true },
    剰余金の配当: { type: 'DOUBLE', optional: true },
    利益剰余金: { type: 'DOUBLE', optional: true },
    短期借入金: { type: 'DOUBLE', optional: true },
    長期借入金: { type: 'DOUBLE', optional: true },
    一株配当: { type: 'DOUBLE', optional: true },
    配当性向: { type: 'DOUBLE', optional: true },
    純資産配当率: { type: 'DOUBLE', optional: true },
    設備投資: { type: 'DOUBLE', optional: true },
    営業CFマージン: { type: 'DOUBLE', optional: true },
    ROA: { type: 'DOUBLE', optional: true },
    総還元性向: { type: 'DOUBLE', optional: true },
    自社株買い: { type: 'DOUBLE', optional: true }
});

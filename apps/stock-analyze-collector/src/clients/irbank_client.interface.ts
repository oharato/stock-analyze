export interface IIrbankClient {
  fetchFinancialData(yearCode: string, fileName: string): Promise<any>;
}

export interface Price {
  date: Date;
  dateString?: string;
  code: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: bigint;
}

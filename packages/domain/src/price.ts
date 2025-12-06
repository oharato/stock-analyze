export interface Price {
  date: Date;
  code: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: bigint;
}

import { CliArgsService, CliArgs } from './cli-args.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CliArgsService', () => {
  let service: CliArgsService;

  beforeEach(() => {
    service = new CliArgsService();
  });

  it('should return default values when no arguments are provided', () => {
    const argv: string[] = ['node', 'script.ts'];
    const expected: CliArgs = {
      codes: null,
      startDate: null,
      endDate: null,
    };
    expect(service.parse(argv)).toEqual(expected);
  });

  it('should parse --codes argument correctly', () => {
    const argv: string[] = ['node', 'script.ts', '--codes', '1234,5678'];
    const expected: CliArgs = {
      codes: ['1234', '5678'],
      startDate: null,
      endDate: null,
    };
    expect(service.parse(argv)).toEqual(expected);
  });

  it('should parse --start-date argument correctly', () => {
    const argv: string[] = ['node', 'script.ts', '--start-date', '2023-01-01'];
    const expected: CliArgs = {
      codes: null,
      startDate: new Date('2023-01-01'),
      endDate: null,
    };
    expect(service.parse(argv)).toEqual(expected);
  });

  it('should parse --end-date argument correctly', () => {
    const argv: string[] = ['node', 'script.ts', '--end-date', '2023-12-31'];
    const expected: CliArgs = {
      codes: null,
      startDate: null,
      endDate: new Date('2023-12-31'),
    };
    expect(service.parse(argv)).toEqual(expected);
  });

  it('should parse all arguments correctly', () => {
    const argv: string[] = ['node', 'script.ts', '--codes', '1234', '--start-date', '2023-01-01', '--end-date', '2023-12-31'];
    const expected: CliArgs = {
      codes: ['1234'],
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
    };
    expect(service.parse(argv)).toEqual(expected);
  });

  it('should handle --codes with a single value', () => {
    const argv: string[] = ['node', 'script.ts', '--codes', '9999'];
    const expected: CliArgs = {
      codes: ['9999'],
      startDate: null,
      endDate: null,
    };
    expect(service.parse(argv)).toEqual(expected);
  });

  it('should handle invalid date format for start-date', () => {
    const argv: string[] = ['node', 'script.ts', '--start-date', 'invalid-date'];
    const result = service.parse(argv);
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.startDate?.toString()).toBe('Invalid Date');
  });

  it('should handle invalid date format for end-date', () => {
    const argv: string[] = ['node', 'script.ts', '--end-date', 'invalid-date'];
    const result = service.parse(argv);
    expect(result.endDate).toBeInstanceOf(Date);
    expect(result.endDate?.toString()).toBe('Invalid Date');
  });
});

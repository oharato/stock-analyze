export interface CliArgs {
  codes: string[] | null;
  startDate: Date | null;
  endDate: Date | null;
}

export class CliArgsService {
  public parse(argv: string[]): CliArgs {
    const args = argv.slice(2);
    const argMap: { [key: string]: string } = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
        argMap[key] = value;
        i++;
      }
    }

    const codes = argMap['codes'] ? argMap['codes'].split(',') : null;
    const startDate = argMap['start-date'] ? new Date(argMap['start-date']) : null;
    const endDate = argMap['end-date'] ? new Date(argMap['end-date']) : null;

    return {
      codes,
      startDate,
      endDate,
    };
  }
}

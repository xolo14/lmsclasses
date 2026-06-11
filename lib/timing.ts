// PERF: Server timing headers utility to measure DB query, cache, and auth times
export class ServerTimer {
  private marks: Map<string, number> = new Map();

  start(label: string) {
    this.marks.set(label, performance.now());
  }

  end(label: string): number {
    const start = this.marks.get(label);
    if (!start) return 0;
    return performance.now() - start;
  }

  // Returns a Server-Timing header value string
  // e.g. "db;dur=12.3, auth;dur=2.1, cache;dur=0.1"
  toHeader(measurements: Record<string, number>): string {
    return Object.entries(measurements)
      .map(([k, v]) => `${k};dur=${v.toFixed(1)}`)
      .join(', ');
  }
}

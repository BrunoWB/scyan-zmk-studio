export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTimeMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  opsPerSec: number;
}

export function benchmark(
  name: string,
  fn: () => void,
  targetDurationMs = 100
): BenchmarkResult {
  // Warmup run
  for (let i = 0; i < 5; i++) {
    fn();
  }

  const times: number[] = [];
  const startTotal = performance.now();
  let elapsed = 0;

  while (elapsed < targetDurationMs && times.length < 5000) {
    const t0 = performance.now();
    fn();
    const t1 = performance.now();
    times.push(t1 - t0);
    elapsed = performance.now() - startTotal;
  }

  times.sort((a, b) => a - b);
  const iterations = times.length;
  const totalTimeMs = times.reduce((sum, t) => sum + t, 0);
  const meanMs = totalTimeMs / iterations;
  const medianMs = times[Math.floor(iterations / 2)];
  const p95Ms = times[Math.min(iterations - 1, Math.floor(iterations * 0.95))];
  const opsPerSec = meanMs > 0 ? 1000 / meanMs : Infinity;

  return {
    name,
    iterations,
    totalTimeMs,
    meanMs,
    medianMs,
    p95Ms,
    opsPerSec,
  };
}

export function printBenchmarkTable(suiteName: string, results: BenchmarkResult[]): void {
  const formatNum = (num: number, decimals = 3) => num.toFixed(decimals);
  const formatOps = (ops: number) => {
    if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M`;
    if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}k`;
    return ops.toFixed(0);
  };

  const header = `=== Benchmark: ${suiteName} ===`;
  console.log(`\n${header}`);
  console.log(''.padEnd(72, '-'));
  console.log(
    'Operation'.padEnd(36) +
    'Mean (ms)'.padStart(12) +
    'p95 (ms)'.padStart(12) +
    'Ops/sec'.padStart(12)
  );
  console.log(''.padEnd(72, '-'));

  for (const r of results) {
    console.log(
      r.name.padEnd(36).slice(0, 36) +
      formatNum(r.meanMs, 4).padStart(12) +
      formatNum(r.p95Ms, 4).padStart(12) +
      formatOps(r.opsPerSec).padStart(12)
    );
  }
  console.log(''.padEnd(72, '-'));
}

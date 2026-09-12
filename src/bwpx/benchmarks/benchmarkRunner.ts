export interface ScenarioMetrics {
  name: string;
  description: string;
  frameCount: number;
  totalDurationMs: number;
  meanFrameMs: number;
  medianFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  maxFrameMs: number;
  fps: number;
  droppedFrames: number; // frames > 16.6ms (60Hz budget)
  droppedFramesPct: number;
  longTasksCount: number; // frames > 50ms
}

export interface BenchmarkSuiteReport {
  timestamp: string;
  userAgent: string;
  devicePixelRatio: number;
  canvasResolution: { width: number; height: number };
  scenarios: ScenarioMetrics[];
  summary: {
    overallScore: number; // 0 - 100 score based on 60fps compliance and p95
    averageFrameMs: number;
    overallFps: number;
    totalDroppedFrames: number;
    totalLongTasks: number;
  };
}

class RafFrameRecorder {
  private frameTimes: number[] = [];
  private lastTime = 0;
  private animId = 0;
  private active = false;

  start(): void {
    this.frameTimes = [];
    this.active = true;
    this.lastTime = performance.now();

    const loop = (now: number) => {
      if (!this.active) return;
      const delta = now - this.lastTime;
      this.lastTime = now;
      if (delta > 0 && delta < 1000) {
        this.frameTimes.push(delta);
      }
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop(name: string, description: string): ScenarioMetrics {
    this.active = false;
    cancelAnimationFrame(this.animId);

    const times = [...this.frameTimes];
    if (times.length === 0) {
      times.push(16.6);
    }
    times.sort((a, b) => a - b);

    const frameCount = times.length;
    const totalDurationMs = times.reduce((sum, t) => sum + t, 0);
    const meanFrameMs = totalDurationMs / frameCount;
    const medianFrameMs = times[Math.floor(frameCount * 0.5)];
    const p95FrameMs = times[Math.min(frameCount - 1, Math.floor(frameCount * 0.95))];
    const p99FrameMs = times[Math.min(frameCount - 1, Math.floor(frameCount * 0.99))];
    const maxFrameMs = times[frameCount - 1];
    const fps = totalDurationMs > 0 ? (frameCount / totalDurationMs) * 1000 : 0;
    const droppedFrames = times.filter(t => t > 16.67).length;
    const droppedFramesPct = (droppedFrames / frameCount) * 100;
    const longTasksCount = times.filter(t => t > 50).length;

    return {
      name,
      description,
      frameCount,
      totalDurationMs,
      meanFrameMs,
      medianFrameMs,
      p95FrameMs,
      p99FrameMs,
      maxFrameMs,
      fps,
      droppedFrames,
      droppedFramesPct,
      longTasksCount,
    };
  }
}

function waitFrames(count: number): Promise<void> {
  return new Promise(resolve => {
    let frames = 0;
    const tick = () => {
      frames++;
      if (frames >= count) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

function dispatchMouseEvent(
  target: HTMLElement,
  type: 'mousedown' | 'mousemove' | 'mouseup',
  clientX: number,
  clientY: number,
  options: { button?: number; buttons?: number; shiftKey?: boolean; ctrlKey?: boolean } = {}
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    button: options.button ?? 0,
    buttons: options.buttons ?? (type === 'mouseup' ? 0 : 1),
    shiftKey: !!options.shiftKey,
    ctrlKey: !!options.ctrlKey,
  });
  target.dispatchEvent(event);
}

/**
 * Runs the full standardized benchmark suite against the current BwpxEditor canvas
 */
export async function runBwpxBenchmark(
  onProgress?: (status: { scenarioIndex: number; totalScenarios: number; name: string; pct: number }) => void
): Promise<BenchmarkSuiteReport> {
  const canvas = document.querySelector('.bwpx-viewport canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Could not find BwpxEditor canvas (.bwpx-viewport canvas). Please ensure BwpxEditor is mounted.');
  }

  const rect = canvas.getBoundingClientRect();
  const centerX = Math.round(rect.left + rect.width / 2);
  const centerY = Math.round(rect.top + rect.height / 2);
  const recorder = new RafFrameRecorder();
  const scenarios: ScenarioMetrics[] = [];

  const totalScenarios = 5;

  // Let browser settle
  await waitFrames(5);

  // --------------------------------------------------------------------------
  // Scenario 1: Continuous Hover Sweeping (300 pointermove events)
  // --------------------------------------------------------------------------
  onProgress?.({ scenarioIndex: 1, totalScenarios, name: 'Hover Sweep (Continuous Pointermove)', pct: 0 });
  recorder.start();

  const hoverFrames = 60;
  for (let f = 0; f < hoverFrames; f++) {
    // 5 events per frame (simulates ~300Hz high polling rate mouse)
    for (let sub = 0; sub < 5; sub++) {
      const t = (f + sub / 5) / hoverFrames;
      const x = centerX + Math.sin(t * Math.PI * 6) * (rect.width * 0.35);
      const y = centerY + Math.cos(t * Math.PI * 4) * (rect.height * 0.25);
      dispatchMouseEvent(canvas, 'mousemove', Math.round(x), Math.round(y), { buttons: 0, button: 0 });
    }
    await waitFrames(1);
    onProgress?.({ scenarioIndex: 1, totalScenarios, name: 'Hover Sweep', pct: (f / hoverFrames) * 100 });
  }

  scenarios.push(
    recorder.stop(
      'Hover Sweep',
      'Rapid continuous pointer movement across canvas, measuring React hoverPos updates & canvas redraws'
    )
  );

  await waitFrames(5);

  // --------------------------------------------------------------------------
  // Scenario 2: Continuous Freehand Drawing (Pencil Stroke)
  // --------------------------------------------------------------------------
  onProgress?.({ scenarioIndex: 2, totalScenarios, name: 'Freehand Pencil Stroke', pct: 0 });
  recorder.start();

  const startDrawX = Math.round(centerX - rect.width * 0.25);
  const startDrawY = Math.round(centerY - rect.height * 0.2);

  dispatchMouseEvent(canvas, 'mousedown', startDrawX, startDrawY, { buttons: 1, button: 0 });

  const drawFrames = 80;
  for (let f = 0; f < drawFrames; f++) {
    for (let sub = 0; sub < 3; sub++) {
      const t = (f + sub / 3) / drawFrames;
      const angle = t * Math.PI * 8;
      const radius = (t * rect.width * 0.3) + 10;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * (radius * 0.5);
      dispatchMouseEvent(canvas, 'mousemove', Math.round(x), Math.round(y), { buttons: 1, button: 0 });
    }
    await waitFrames(1);
    onProgress?.({ scenarioIndex: 2, totalScenarios, name: 'Freehand Pencil Stroke', pct: (f / drawFrames) * 100 });
  }

  dispatchMouseEvent(canvas, 'mouseup', centerX, centerY, { buttons: 0, button: 0 });

  scenarios.push(
    recorder.stop(
      'Freehand Pencil Stroke',
      'Continuous pencil stroke dragging, stressing grid.clone(), lineDraw algorithm, setGrid, and pixel redraws'
    )
  );

  await waitFrames(5);

  // --------------------------------------------------------------------------
  // Scenario 3: Continuous Viewport Pan Drag
  // --------------------------------------------------------------------------
  onProgress?.({ scenarioIndex: 3, totalScenarios, name: 'Viewport Pan Drag', pct: 0 });
  recorder.start();

  dispatchMouseEvent(canvas, 'mousedown', centerX, centerY, { buttons: 4, button: 1 }); // Middle click pan

  const panFrames = 90;
  for (let f = 0; f < panFrames; f++) {
    for (let sub = 0; sub < 2; sub++) {
      const t = (f + sub / 2) / panFrames;
      const x = centerX + Math.sin(t * Math.PI * 4) * 120;
      const y = centerY + Math.cos(t * Math.PI * 4) * 60;
      dispatchMouseEvent(canvas, 'mousemove', Math.round(x), Math.round(y), { buttons: 4, button: 1 });
    }
    await waitFrames(1);
    onProgress?.({ scenarioIndex: 3, totalScenarios, name: 'Viewport Pan Drag', pct: (f / panFrames) * 100 });
  }

  dispatchMouseEvent(canvas, 'mouseup', centerX, centerY, { buttons: 0, button: 1 });

  scenarios.push(
    recorder.stop(
      'Viewport Pan Drag',
      'Continuous pan dragging across frames, stressing setPan, grid line recalculation, and transform redraws'
    )
  );

  await waitFrames(5);

  // --------------------------------------------------------------------------
  // Scenario 4: Marquee Selection & Dragging
  // --------------------------------------------------------------------------
  onProgress?.({ scenarioIndex: 4, totalScenarios, name: 'Marquee Select & Move', pct: 0 });
  recorder.start();

  const selStartX = Math.round(centerX - 80);
  const selStartY = Math.round(centerY - 40);
  const selEndX = Math.round(centerX + 80);
  const selEndY = Math.round(centerY + 40);

  // Marquee drag with ctrlKey
  dispatchMouseEvent(canvas, 'mousedown', selStartX, selStartY, { buttons: 1, button: 0, ctrlKey: true });
  for (let f = 0; f < 30; f++) {
    const t = f / 30;
    const curX = Math.round(selStartX + (selEndX - selStartX) * t);
    const curY = Math.round(selStartY + (selEndY - selStartY) * t);
    dispatchMouseEvent(canvas, 'mousemove', curX, curY, { buttons: 1, button: 0, ctrlKey: true });
    await waitFrames(1);
  }
  dispatchMouseEvent(canvas, 'mouseup', selEndX, selEndY, { buttons: 0, button: 0, ctrlKey: true });

  await waitFrames(5);

  // Move selected region
  dispatchMouseEvent(canvas, 'mousedown', centerX, centerY, { buttons: 1, button: 0, ctrlKey: true });
  for (let f = 0; f < 40; f++) {
    const t = f / 40;
    const curX = Math.round(centerX + Math.sin(t * Math.PI * 2) * 50);
    const curY = Math.round(centerY + Math.cos(t * Math.PI * 2) * 30);
    dispatchMouseEvent(canvas, 'mousemove', curX, curY, { buttons: 1, button: 0, ctrlKey: true });
    await waitFrames(1);
    onProgress?.({ scenarioIndex: 4, totalScenarios, name: 'Marquee Select & Move', pct: (f / 40) * 100 });
  }
  dispatchMouseEvent(canvas, 'mouseup', centerX, centerY, { buttons: 0, button: 0, ctrlKey: true });

  scenarios.push(
    recorder.stop(
      'Marquee Select & Move',
      'Box selection drag and moving extracted pixel slice with active ghost preview overlay'
    )
  );

  await waitFrames(5);

  // --------------------------------------------------------------------------
  // Scenario 5: Rapid Density & Zoom Scaling
  // --------------------------------------------------------------------------
  onProgress?.({ scenarioIndex: 5, totalScenarios, name: 'Zoom & Density Scaling', pct: 0 });
  recorder.start();

  // Synthetic wheel zoom events
  const zoomSteps = [1, 2, 4, 8, 16, 24, 32, 16, 8, 4, 2, 1];
  for (let i = 0; i < zoomSteps.length; i++) {
    const deltaY = i < zoomSteps.length / 2 ? -100 : 100;
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: centerX,
      clientY: centerY,
      deltaY,
    });
    canvas.dispatchEvent(wheelEvent);
    await waitFrames(3);
    onProgress?.({ scenarioIndex: 5, totalScenarios, name: 'Zoom & Density Scaling', pct: (i / zoomSteps.length) * 100 });
  }

  scenarios.push(
    recorder.stop(
      'Zoom Scaling',
      'Stepping through zoom levels from 1x to 32x, stressing pixel batching, coordinate culling, and grid lines'
    )
  );

  // --------------------------------------------------------------------------
  // Compute Aggregate Report Summary
  // --------------------------------------------------------------------------
  const allFrameTimesMs = scenarios.map(s => s.meanFrameMs);
  const avgFrameMs = allFrameTimesMs.reduce((a, b) => a + b, 0) / scenarios.length;
  const overallFps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
  const totalDroppedFrames = scenarios.reduce((sum, s) => sum + s.droppedFrames, 0);
  const totalLongTasks = scenarios.reduce((sum, s) => sum + s.longTasksCount, 0);

  // Calculate score (100 is smooth 60fps with 0 dropped frames, penalize for dropped frames and p95 latency)
  const avgDroppedPct = scenarios.reduce((sum, s) => sum + s.droppedFramesPct, 0) / scenarios.length;
  const maxP95 = Math.max(...scenarios.map(s => s.p95FrameMs));
  let score = 100 - (avgDroppedPct * 0.6) - (Math.max(0, maxP95 - 16.6) * 1.5) - (totalLongTasks * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const report: BenchmarkSuiteReport = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio || 1,
    canvasResolution: { width: canvas.width, height: canvas.height },
    scenarios,
    summary: {
      overallScore: score,
      averageFrameMs: Number(avgFrameMs.toFixed(2)),
      overallFps: Number(overallFps.toFixed(1)),
      totalDroppedFrames,
      totalLongTasks,
    },
  };

  // Expose on window for programmatic CLI scrapers
  if (typeof window !== 'undefined') {
    (window as unknown as { __BWPX_BENCHMARK_RESULT__?: BenchmarkSuiteReport }).__BWPX_BENCHMARK_RESULT__ = report;
  }

  return report;
}

// Attach globally
if (typeof window !== 'undefined') {
  (window as unknown as { __RUN_BWPX_BENCHMARK__?: typeof runBwpxBenchmark }).__RUN_BWPX_BENCHMARK__ = runBwpxBenchmark;
}

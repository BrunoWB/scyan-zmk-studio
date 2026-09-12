#!/usr/bin/env node
/**
 * Headed & Headless In-Browser Benchmark Runner
 * Runs standardized user interaction scenarios on the BwpxEditor canvas using
 * the Chrome DevTools Protocol (CDP) and native WebSockets.
 */

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const IS_HEADLESS = process.argv.includes('--headless');
const BENCH_PORT = 5179;
const CDP_PORT = 9222;
const APP_URL = `http://127.0.0.1:${BENCH_PORT}/?bench=true#symbols`;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // wait and retry
    }
    await sleep(250);
  }
  return false;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }

  init() {
    return new Promise((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = err => rej(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log(`\n🚀 Initializing Scyan Pixel Editor In-Browser Benchmark Runner`);
  console.log(`   Mode: ${IS_HEADLESS ? 'Headless (CI)' : 'Headed (Real GPU & Display VSync)'}`);
  console.log(`   Target: ${APP_URL}\n`);

  // 1. Start isolated Vite dev server
  console.log(`[1/5] Starting local Vite server on port ${BENCH_PORT}...`);
  const viteProcess = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(BENCH_PORT), '--strictPort'], {
    stdio: 'pipe',
    env: { ...process.env, BROWSER: 'none' },
  });

  viteProcess.stderr.on('data', d => {
    const s = d.toString();
    if (s.includes('error') || s.includes('Error')) {
      console.error('Vite Error:', s);
    }
  });

  const viteReady = await waitForUrl(`http://127.0.0.1:${BENCH_PORT}/`);
  if (!viteReady) {
    viteProcess.kill();
    throw new Error(`Failed to start Vite server on port ${BENCH_PORT}`);
  }
  console.log(`      ✓ Vite server listening at http://127.0.0.1:${BENCH_PORT}/`);

  // 2. Launch browser
  console.log(`[2/5] Launching ${IS_HEADLESS ? 'headless' : 'headed'} browser with CDP...`);
  
  const browserArgs = [
    `--remote-debugging-port=${CDP_PORT}`,
    '--user-data-dir=/tmp/scyan-bench-profile',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--window-size=1280,900',
  ];

  if (IS_HEADLESS) {
    browserArgs.push('--headless=new');
  }

  let browserProcess;
  // Test if running inside flatpak container
  try {
    browserProcess = spawn(
      'flatpak-spawn',
      ['--host', 'flatpak', 'run', 'com.brave.Browser', ...browserArgs, APP_URL],
      { stdio: 'ignore' }
    );
  } catch {
    // Fallback to local command
    browserProcess = spawn('google-chrome', [...browserArgs, APP_URL], { stdio: 'ignore' });
  }

  const cdpReady = await waitForUrl(`http://127.0.0.1:${CDP_PORT}/json/version`, 10000);
  if (!cdpReady) {
    cleanup();
    throw new Error(`CDP failed to become ready on port ${CDP_PORT}`);
  }
  console.log(`      ✓ Browser launched with CDP on port ${CDP_PORT}`);

  // 3. Connect to page via CDP WebSocket
  console.log(`[3/5] Connecting CDP client to active page...`);
  let pageTarget = null;
  for (let i = 0; i < 20; i++) {
    try {
      const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await listRes.json();
      pageTarget = targets.find(t => t.type === 'page' && t.url.includes(String(BENCH_PORT))) || targets.find(t => t.type === 'page');
      if (pageTarget?.webSocketDebuggerUrl) break;
    } catch {}
    await sleep(250);
  }

  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    cleanup();
    throw new Error('Could not find active browser page target in CDP list');
  }

  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.init();
  await client.send('Runtime.enable');
  await client.send('Page.enable');

  // Navigate to benchmark URL to ensure correct page is loaded
  await client.send('Page.navigate', { url: APP_URL });
  console.log(`      ✓ Connected to page and navigated to ${APP_URL}`);

  // 4. Wait for BwpxEditor canvas to mount
  console.log(`[4/5] Waiting for BwpxEditor canvas to mount in DOM...`);
  let canvasReady = false;
  for (let i = 0; i < 30; i++) {
    const evalRes = await client.send('Runtime.evaluate', {
      expression: 'Boolean(document.querySelector(".bwpx-viewport canvas") && typeof window.__RUN_BWPX_BENCHMARK__ === "function")',
      returnByValue: true,
    });
    if (evalRes?.result?.value === true) {
      canvasReady = true;
      break;
    }
    await sleep(300);
  }

  if (!canvasReady) {
    cleanup();
    throw new Error('Timeout waiting for BwpxEditor canvas to mount');
  }
  console.log(`      ✓ Canvas and benchmark runner ready`);

  // 5. Execute benchmark suite
  console.log(`[5/5] Executing benchmark suite (5 scenarios)...`);
  console.log(`      - Scenario 1: Hover Sweeping (300 events)`);
  console.log(`      - Scenario 2: Freehand Drawing (Pencil stroke)`);
  console.log(`      - Scenario 3: Viewport Pan Dragging (120 frames)`);
  console.log(`      - Scenario 4: Marquee Selection & Dragging`);
  console.log(`      - Scenario 5: Multi-Density Zoom & Blitting\n`);

  const benchmarkResult = await client.send('Runtime.evaluate', {
    expression: 'window.__RUN_BWPX_BENCHMARK__()',
    awaitPromise: true,
    returnByValue: true,
  });

  const report = benchmarkResult?.result?.value;
  if (!report || !report.scenarios) {
    cleanup();
    throw new Error('Benchmark returned empty or invalid report: ' + JSON.stringify(benchmarkResult));
  }

  // Print Formatted Report
  printReportTable(report);

  // Save baseline JSON
  const outputPath = resolve(process.cwd(), 'benchmark-baseline.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n💾 Saved baseline benchmark report to: ${outputPath}\n`);

  client.close();
  cleanup();

  function cleanup() {
    try {
      viteProcess.kill();
    } catch {}
    try {
      browserProcess?.kill();
    } catch {}
    try {
      spawn('flatpak-spawn', ['--host', 'flatpak', 'kill', 'com.brave.Browser'], { stdio: 'ignore' });
    } catch {}
  }
}

function printReportTable(report) {
  const line = ''.padEnd(80, '─');
  console.log(line);
  console.log(`  BWPX PIXEL EDITOR BENCHMARK REPORT (${report.summary.overallScore}/100)`);
  console.log(line);
  console.log(
    'Scenario'.padEnd(28) +
    'Mean (ms)'.padStart(10) +
    'p95 (ms)'.padStart(10) +
    'Max (ms)'.padStart(10) +
    'FPS'.padStart(8) +
    'Dropped'.padStart(14)
  );
  console.log(line);

  for (const s of report.scenarios) {
    const droppedStr = `${s.droppedFrames} (${s.droppedFramesPct.toFixed(1)}%)`;
    console.log(
      s.name.padEnd(28).slice(0, 28) +
      s.meanFrameMs.toFixed(2).padStart(10) +
      s.p95FrameMs.toFixed(2).padStart(10) +
      s.maxFrameMs.toFixed(2).padStart(10) +
      s.fps.toFixed(1).padStart(8) +
      droppedStr.padStart(14)
    );
  }
  console.log(line);
  console.log(`Overall FPS: ${report.summary.overallFps} | Mean Frame Time: ${report.summary.averageFrameMs}ms | Total Dropped Frames: ${report.summary.totalDroppedFrames}`);
  console.log(`Tested Resolution: ${report.canvasResolution.width}x${report.canvasResolution.height} (DPR ${report.devicePixelRatio})`);
  console.log(line);
}

main().catch(err => {
  console.error('\n❌ Benchmark Error:', err);
  process.exit(1);
});

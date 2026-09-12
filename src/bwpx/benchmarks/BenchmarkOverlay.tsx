import React, { useState, useEffect } from 'react';
import { runBwpxBenchmark, type BenchmarkSuiteReport } from './benchmarkRunner';
import { Play, Check, Copy, Download, X, Activity, AlertTriangle } from 'lucide-react';
import './BenchmarkOverlay.css';

interface BenchmarkOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkOverlay: React.FC<BenchmarkOverlayProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<{
    scenarioIndex: number;
    totalScenarios: number;
    name: string;
    pct: number;
  } | null>(null);
  const [report, setReport] = useState<BenchmarkSuiteReport | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-run if requested via URL param "?bench_autorun=true"
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.location.search.includes('bench_autorun=true')) {
      handleRun();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    setReport(null);
    setCurrentStatus(null);
    try {
      const res = await runBwpxBenchmark(status => {
        setCurrentStatus(status);
      });
      setReport(res);
    } catch (err) {
      console.error('Benchmark execution error:', err);
      alert(err instanceof Error ? err.message : 'Benchmark failed');
    } finally {
      setIsRunning(false);
      setCurrentStatus(null);
    }
  };

  const handleCopyJson = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bwpx-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bwpx-bench-overlay" onClick={e => e.stopPropagation()}>
      <div className="bwpx-bench-modal">
        {/* Header */}
        <div className="bwpx-bench-header">
          <div className="bwpx-bench-title-row">
            <Activity size={18} className="text-emerald-400" />
            <h2 className="bwpx-bench-title">Pixel Editor Profiling Benchmark</h2>
            <span className="bwpx-bench-badge">Headed W3C Profiler</span>
          </div>
          <button onClick={onClose} className="bwpx-bench-close" title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="bwpx-bench-body">
          <p className="bwpx-bench-intro">
            Measures real hardware GPU rasterization, frame budgeting (60Hz / 16.6ms), and pointer latency by dispatching standardized automated user interactions across the editor canvas.
          </p>

          {/* Action Bar */}
          <div className="bwpx-bench-controls">
            <button
              onClick={handleRun}
              disabled={isRunning}
              className={`bwpx-bench-btn-run ${isRunning ? 'running' : ''}`}
            >
              <Play size={14} />
              {isRunning ? 'Running Profiler...' : report ? 'Re-run Benchmark' : 'Start Benchmark'}
            </button>

            {report && (
              <div className="bwpx-bench-export-group">
                <button onClick={handleCopyJson} className="bwpx-bench-btn-sec">
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
                <button onClick={handleDownloadJson} className="bwpx-bench-btn-sec">
                  <Download size={14} />
                  Download
                </button>
              </div>
            )}
          </div>

          {/* Running progress bar */}
          {isRunning && currentStatus && (
            <div className="bwpx-bench-progress-box">
              <div className="bwpx-bench-progress-label">
                <span>Scenario {currentStatus.scenarioIndex} of {currentStatus.totalScenarios}: <strong>{currentStatus.name}</strong></span>
                <span>{Math.round(currentStatus.pct)}%</span>
              </div>
              <div className="bwpx-bench-progress-track">
                <div
                  className="bwpx-bench-progress-bar"
                  style={{ width: `${currentStatus.pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Results View */}
          {report && (
            <div className="bwpx-bench-results">
              {/* Summary Cards */}
              <div className="bwpx-bench-cards">
                <div className="bwpx-bench-card">
                  <div className="bwpx-bench-card-val text-emerald-400">{report.summary.overallScore} / 100</div>
                  <div className="bwpx-bench-card-lbl">Smoothness Score</div>
                </div>
                <div className="bwpx-bench-card">
                  <div className="bwpx-bench-card-val">{report.summary.overallFps} FPS</div>
                  <div className="bwpx-bench-card-lbl">Effective Frame Rate</div>
                </div>
                <div className="bwpx-bench-card">
                  <div className="bwpx-bench-card-val">{report.summary.averageFrameMs} ms</div>
                  <div className="bwpx-bench-card-lbl">Mean Frame Duration</div>
                </div>
                <div className={`bwpx-bench-card ${report.summary.totalDroppedFrames > 0 ? 'warning' : ''}`}>
                  <div className="bwpx-bench-card-val">
                    {report.summary.totalDroppedFrames}
                    {report.summary.totalLongTasks > 0 && (
                      <span className="text-xs text-red-400 font-normal ml-1">
                        ({report.summary.totalLongTasks} freezes)
                      </span>
                    )}
                  </div>
                  <div className="bwpx-bench-card-lbl">Dropped Frames (&gt;16.6ms)</div>
                </div>
              </div>

              {/* Detail Table */}
              <div className="bwpx-bench-table-wrapper">
                <table className="bwpx-bench-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Mean</th>
                      <th>p95</th>
                      <th>Max</th>
                      <th>FPS</th>
                      <th>Dropped Frames</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.scenarios.map(s => {
                      const isJanky = s.droppedFramesPct > 10 || s.p95FrameMs > 16.67;
                      return (
                        <tr key={s.name}>
                          <td className="font-medium text-slate-200">
                            <div>{s.name}</div>
                            <div className="text-xs text-slate-500 font-normal">{s.description}</div>
                          </td>
                          <td>{s.meanFrameMs.toFixed(2)} ms</td>
                          <td className={s.p95FrameMs > 16.67 ? 'text-amber-400 font-bold' : ''}>
                            {s.p95FrameMs.toFixed(2)} ms
                          </td>
                          <td className={s.maxFrameMs > 33.3 ? 'text-red-400 font-bold' : ''}>
                            {s.maxFrameMs.toFixed(2)} ms
                          </td>
                          <td>{s.fps.toFixed(1)}</td>
                          <td>
                            {s.droppedFrames} ({s.droppedFramesPct.toFixed(1)}%)
                          </td>
                          <td>
                            {isJanky ? (
                              <span className="bwpx-bench-tag-jank">
                                <AlertTriangle size={12} />
                                Laggy
                              </span>
                            ) : (
                              <span className="bwpx-bench-tag-smooth">Smooth</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bwpx-bench-meta">
                Tested resolution: {report.canvasResolution.width}×{report.canvasResolution.height} (DPR {report.devicePixelRatio}) • {report.timestamp}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

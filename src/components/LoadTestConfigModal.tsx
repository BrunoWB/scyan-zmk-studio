import React, { useState, useMemo } from 'react';
import {
  X,
  FlaskConical,
  Search,
  ExternalLink,
  Layers,
  Monitor,
  Battery,
  BatteryLow,
  Cpu,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { TEST_KEYBOARD_CONFIGS, type TestKeyboardConfig } from '../testing/testConfigs';
import { loadTestConfigIntoStudio } from '../testing/loadTestConfig';

interface LoadTestConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoaded?: (config: TestKeyboardConfig) => void;
}

export const LoadTestConfigModal: React.FC<LoadTestConfigModalProps> = ({
  isOpen,
  onClose,
  onLoaded,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFileConfigId, setExpandedFileConfigId] = useState<string | null>(null);
  const [activeFileTab, setActiveFileTab] = useState<'build' | 'conf' | 'keymap'>('build');

  const filteredConfigs = useMemo(() => {
    return TEST_KEYBOARD_CONFIGS.filter((config) => {
      if (selectedCategory !== 'all' && config.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        config.name.toLowerCase().includes(q) ||
        config.description.toLowerCase().includes(q) ||
        config.repo.repo.toLowerCase().includes(q) ||
        config.expectedShieldIds.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleLoad = (config: TestKeyboardConfig) => {
    const ok = loadTestConfigIntoStudio(config.id);
    if (ok) {
      onLoaded?.(config);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07090e]/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] bg-[#10141f] border border-[#232c3f] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2538] bg-[#141926]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              <FlaskConical size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Load Test Configuration</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20">
                  DEV TOOL
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Simulate GitHub repository discovery and test non-standard keyboard topologies in Scyan ZMK Studio.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-white p-1.5 rounded-lg hover:bg-[#1e2538] transition-colors"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 border-b border-[#1e2538] bg-[#0d1017] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All Scenarios' },
              { id: 'genteure', label: 'Genteure Repos' },
              { id: 'split', label: 'Split Topologies' },
              { id: 'unibody', label: 'Unibody' },
              { id: 'dongle', label: 'Dongle Setups' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#181f2f] border border-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
            <input
              type="text"
              placeholder="Filter configs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#151a27] border border-[#232c3f] rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#00f0ff]/50 transition-colors"
            />
          </div>
        </div>

        {/* Config List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredConfigs.length === 0 ? (
            <div className="py-12 text-center text-[#64748b]">
              <p className="text-sm">No test configurations match your filter criteria.</p>
            </div>
          ) : (
            filteredConfigs.map((config) => {
              const isExpanded = expandedFileConfigId === config.id;
              return (
                <div
                  key={config.id}
                  className="bg-[#131824] border border-[#1e2538] hover:border-[#2d3748] rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-sm text-white">{config.name}</span>

                        {config.category === 'genteure' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#ec4899]/10 text-[#ec4899] border border-[#ec4899]/30">
                            Genteure Tester
                          </span>
                        )}

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 flex items-center gap-1">
                          <Layers size={11} />
                          {config.topology.partsCount} {config.topology.partsCount === 1 ? 'Part' : 'Parts'}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 flex items-center gap-1">
                          <Monitor size={11} />
                          {config.topology.displayCount}{' '}
                          {config.topology.displayCount === 1 ? 'Display' : 'Displays'}
                        </span>

                        {config.topology.hasBattery ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/30 flex items-center gap-1">
                            <Battery size={11} />
                            LiPo Battery
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#64748b]/15 text-[#94a3b8] border border-[#64748b]/30 flex items-center gap-1">
                            <BatteryLow size={11} />
                            Wired USB
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#94a3b8] leading-relaxed">{config.description}</p>

                      {config.notes && (
                        <p className="text-[11px] text-[#00f0ff]/80 font-mono bg-[#00f0ff]/5 px-2.5 py-1 rounded-md border border-[#00f0ff]/15">
                          💡 <span className="font-medium">Verification Focus:</span> {config.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-4 pt-1 text-[11px] text-[#64748b]">
                        <span className="flex items-center gap-1">
                          <Cpu size={12} className="text-[#38bdf8]" />
                          Shields: {config.expectedShieldIds.join(', ')}
                        </span>
                        {config.repo.url && (
                          <a
                            href={config.repo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#38bdf8] hover:underline flex items-center gap-1"
                          >
                            <ExternalLink size={11} />
                            {config.repo.owner}/{config.repo.repo}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleLoad(config)}
                        className="px-4 py-2 rounded-lg bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-[#07090e] font-bold text-xs shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Sparkles size={13} />
                        <span>Load Config</span>
                      </button>

                      <button
                        onClick={() =>
                          setExpandedFileConfigId(isExpanded ? null : config.id)
                        }
                        className="text-[11px] text-[#94a3b8] hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1e2538] transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>{isExpanded ? 'Hide Files' : 'Inspect Files'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded File Viewer */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#1e2538] space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveFileTab('build')}
                          className={`text-[11px] font-mono px-2.5 py-1 rounded ${
                            activeFileTab === 'build'
                              ? 'bg-[#1e2538] text-[#00f0ff] font-semibold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          build.yaml
                        </button>
                        <button
                          onClick={() => setActiveFileTab('conf')}
                          className={`text-[11px] font-mono px-2.5 py-1 rounded ${
                            activeFileTab === 'conf'
                              ? 'bg-[#1e2538] text-[#00f0ff] font-semibold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          {config.confFiles[0]?.path || '.conf'}
                        </button>
                        <button
                          onClick={() => setActiveFileTab('keymap')}
                          className={`text-[11px] font-mono px-2.5 py-1 rounded ${
                            activeFileTab === 'keymap'
                              ? 'bg-[#1e2538] text-[#00f0ff] font-semibold'
                              : 'text-[#94a3b8] hover:text-white'
                          }`}
                        >
                          {config.keymapFile.path}
                        </button>
                      </div>

                      <pre className="p-3 bg-[#0a0d14] border border-[#1b2234] rounded-lg text-[11px] font-mono text-[#cbd5e1] overflow-x-auto max-h-48 whitespace-pre leading-relaxed">
                        {activeFileTab === 'build' && config.buildYaml}
                        {activeFileTab === 'conf' &&
                          (config.confFiles[0]?.content || '# No conf content')}
                        {activeFileTab === 'keymap' && config.keymapFile.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#1e2538] bg-[#141926] flex items-center justify-between text-xs text-[#64748b]">
          <span>Select any configuration to simulate loading into Studio state.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#1e2538] hover:bg-[#28324a] text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

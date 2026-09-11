import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, GitCommit, Sparkles, Tag, Wrench, X } from 'lucide-react';
import { CHANGELOG_DATA, REPOSITORY_URL, type ReleaseEntry } from '../data/changelog';

export interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const currentCommit = typeof __GIT_COMMIT_HASH__ !== 'undefined' ? __GIT_COMMIT_HASH__ : 'c7b86f1';

  const modalNode = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-modal-title"
    >
      <div
        className="bg-[#11141c] border border-[#2d3748] rounded-2xl w-full max-w-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85),_0_0_20px_rgba(0,240,255,0.06)] flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2538] bg-[#0d1017] shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              <Sparkles size={16} className="text-[#00f0ff]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 id="changelog-modal-title" className="text-base font-bold text-white tracking-tight">
                  Change Log &amp; Release History
                </h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                  <span className="size-1.5 rounded-full bg-[#00f0ff] animate-pulse"></span>
                  v{currentVersion} ({currentCommit})
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5 font-sans">
                Deployed updates and feature milestones for Scyan ZMK Studio
              </p>
            </div>
          </div>

          <button
            type="button"
            className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-[#19202f]"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Scrollable Release Feed */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0 divide-y divide-[#1e2538]/60">
          {CHANGELOG_DATA.map((release: ReleaseEntry) => {
            const isCurrentRelease =
              currentVersion === release.version ||
              release.patches.some((p) => p.patch === currentVersion);

            return (
              <article
                key={release.version}
                className={`pt-6 first:pt-0 space-y-4 ${
                  isCurrentRelease ? 'relative' : ''
                }`}
              >
                {/* Major / Minor Header Card */}
                <div className="bg-[#161a26] border border-[#263147] rounded-xl p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border tracking-wide uppercase ${
                          release.type === 'major'
                            ? 'bg-[#f59442]/15 text-[#f59442] border-[#f59442]/40 shadow-[0_0_10px_rgba(245,148,66,0.2)]'
                            : 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30 shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                        }`}
                      >
                        v{release.version} • {release.type}
                      </span>
                      {isCurrentRelease && (
                        <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                          Active Version
                        </span>
                      )}
                    </div>
                    <time className="text-xs font-mono text-[#64748b]">{release.date}</time>
                  </div>

                  <h4 className="text-base font-bold text-white tracking-tight mb-2">
                    {release.title}
                  </h4>

                  <p className="text-xs text-[#cbd5e1] leading-relaxed mb-4">
                    {release.description}
                  </p>

                  {/* Highlights list */}
                  {release.highlights && release.highlights.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#20293d]">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#94a3b8] font-semibold block mb-1">
                        Highlights:
                      </span>
                      <ul className="space-y-1">
                        {release.highlights.map((highlight, idx) => (
                          <li key={idx} className="text-xs text-[#94a3b8] flex items-start gap-2">
                            <span className="text-[#00f0ff] mt-0.5">▸</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Patches Subsection: Compact Patch Display */}
                {release.patches && release.patches.length > 0 && (
                  <div className="pl-3 sm:pl-5 border-l-2 border-[#20293d] space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#64748b] uppercase tracking-wider font-semibold">
                      <Wrench size={12} className="text-[#94a3b8]" />
                      <span>Patches for v{release.version}</span>
                    </div>

                    <div className="space-y-2.5">
                      {release.patches.map((patch) => {
                        const isCurrentPatch = currentVersion === patch.patch;
                        return (
                          <div
                            key={patch.patch}
                            className={`p-3 rounded-lg border text-xs transition-colors ${
                              isCurrentPatch
                                ? 'bg-[#192233]/70 border-[#00f0ff]/40'
                                : 'bg-[#141824]/60 border-[#222b3d]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#fed7aa] bg-[#f59442]/10 border border-[#f59442]/30 px-1.5 py-0.5 rounded text-[11px]">
                                  {`patch ${patch.patch}`}
                                </span>
                                {patch.commitHash && (
                                  <a
                                    href={`${REPOSITORY_URL}/commit/${patch.commitHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-mono text-[#00f0ff] hover:text-[#38bdf8] transition-colors"
                                    title={`View commit ${patch.commitHash} on GitHub`}
                                  >
                                    <GitCommit size={11} />
                                    <span>{patch.commitHash}</span>
                                    <ExternalLink size={10} className="opacity-70" />
                                  </a>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-[#64748b]">{patch.date}</span>
                            </div>

                            <ul className="space-y-1 pl-1">
                              {patch.changes.map((change, cIdx) => (
                                <li key={cIdx} className="text-xs text-[#94a3b8] flex items-start gap-1.5">
                                  <span className="text-[#64748b]">•</span>
                                  <span>{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#1e2538] bg-[#0d1017] shrink-0">
          <a
            href={`${REPOSITORY_URL}/commits/main`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-[#00f0ff] transition-colors font-mono"
          >
            <Tag size={13} />
            <span>Browse Full Git History</span>
            <ExternalLink size={11} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-[#2d3748] bg-[#1a202c] text-white hover:bg-[#2d3748] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(modalNode, document.body)
    : modalNode;
};

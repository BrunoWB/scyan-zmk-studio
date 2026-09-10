import { useState, useEffect } from 'react';
import { Search, X, Layers, Palette, Terminal, Zap, Tag, Bell } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  onSelectSection: (sectionId: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onSelectSection }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    { id: 'tokens', title: 'Design Tokens & Color Palette', icon: Palette, category: 'Foundation' },
    { id: 'typography', title: 'Typography Hierarchy & Code Block', icon: Terminal, category: 'Foundation' },
    { id: 'actions', title: 'Buttons & Action Controls (Tri-Tone)', icon: Zap, category: 'Interactive' },
    { id: 'forms', title: 'Form Controls & Coordinate Steppers', icon: Search, category: 'Interactive' },
    { id: 'badges', title: 'Badges, Tags & Status Chips', icon: Tag, category: 'Indicators' },
    { id: 'cards', title: 'Items Cards (Hardware, Layers, OLED Spec)', icon: Layers, category: 'Containers' },
    { id: 'atlas', title: 'Atlas List (1-Item & 2-Item Slots, Wrapped Groups)', icon: Layers, category: 'Lists' },
    { id: 'feedback', title: 'Alerts, Callout Banners & Toasts', icon: Bell, category: 'Feedback' },
  ];

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#131722] border border-[#2d3748] rounded-2xl w-full max-w-xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
        {/* Input Bar */}
        <div className="p-4 border-b border-[#1e2538] flex items-center gap-3">
          <Search className="size-4 text-[#00f0ff]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search sections, tokens, or components..."
            className="w-full bg-transparent text-sm text-white placeholder-[#555e6e] outline-none"
          />
          <button
            onClick={() => onClose(false)}
            className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#94a3b8]">
              No matching sections found for "{query}".
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectSection(item.id);
                    onClose(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#19202f] hover:border-[#00f0ff]/30 border border-transparent transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-[#0b0d13] border border-[#1e2538] flex items-center justify-center group-hover:border-[#00f0ff]/40">
                      <Icon className="size-4 text-[#00f0ff]" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-[#00f0ff] transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-[#94a3b8]">{item.category}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#555e6e] group-hover:text-[#94a3b8]">Jump ↵</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0b0d13] border-t border-[#1e2538] flex items-center justify-between text-[11px] font-mono text-[#555e6e]">
          <span>Use ESC to close</span>
          <span className="text-[#00f0ff]">Scyan Design System</span>
        </div>
      </div>
    </div>
  );
}

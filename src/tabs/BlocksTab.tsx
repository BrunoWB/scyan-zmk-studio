import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import {
  DEFAULT_LEFT_LAYOUT_BLOCKS,
  DEFAULT_RIGHT_LAYOUT_BLOCKS,
} from '../types/zmk';
import type { DisplayWidgetDefinition, DragWidgetState } from '../types/widget';
import { getWidgetNaturalSize } from '../services/widgetRegistry';
import { OledPanelColumn } from './blocks/OledPanelColumn';
import { WidgetCatalogList } from './blocks/WidgetCatalogList';
import { GhostDragOverlay } from './blocks/GhostDragOverlay';

export interface BlocksTabProps {
  leftBlocks?: LayoutBlock[];
  rightBlocks?: LayoutBlock[];
  onLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  idleLeftBlocks?: LayoutBlock[];
  idleRightBlocks?: LayoutBlock[];
  onIdleLeftBlocksChange?: (blocks: LayoutBlock[]) => void;
  onIdleRightBlocksChange?: (blocks: LayoutBlock[]) => void;
  screenDimensions?: { width: number; height: number };
  onScreenDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  onResetDefaults?: () => void;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  customText: string;
  instances?: import('../types/widget').WidgetInstanceMap;
  onInstancesChange?: (instances: import('../types/widget').WidgetInstanceMap) => void;

  // Backwards compatibility props
  layoutBlocks?: LayoutBlock[];
  onLayoutBlocksChange?: (blocks: LayoutBlock[]) => void;
}

export const BlocksTab: React.FC<BlocksTabProps> = ({
  leftBlocks,
  rightBlocks,
  onLeftBlocksChange,
  onRightBlocksChange,
  idleLeftBlocks,
  idleRightBlocks,
  onIdleLeftBlocksChange,
  onIdleRightBlocksChange,
  screenDimensions = { width: 32, height: 128 },
  onScreenDimensionsChange: _onScreenDimensionsChange,
  onResetDefaults: _onResetDefaults,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  customText,
  instances,
  onInstancesChange: _onInstancesChange,
  layoutBlocks,
  onLayoutBlocksChange,
}) => {
  // Active screen blocks
  const effectiveLeftBlocks = leftBlocks ?? layoutBlocks ?? DEFAULT_LEFT_LAYOUT_BLOCKS;
  const effectiveRightBlocks = rightBlocks ?? DEFAULT_RIGHT_LAYOUT_BLOCKS;

  // Idle screen blocks
  const effectiveIdleLeftBlocks = idleLeftBlocks ?? [
    { id: 'idle-left-art', widgetType: 'screensaver', name: 'Mascot Image', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'left' }
  ];
  const effectiveIdleRightBlocks = idleRightBlocks ?? [
    { id: 'idle-right-art', widgetType: 'screensaver', name: 'Mascot Image', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'right' }
  ];

  // Screen focus mode: 'active' or 'idle'
  const [focusedScreenMode, setFocusedScreenMode] = useState<'active' | 'idle'>('active');

  const handleLeftBlocksChange = (newBlocks: LayoutBlock[]) => {
    if (onLeftBlocksChange) onLeftBlocksChange(newBlocks);
    if (onLayoutBlocksChange) onLayoutBlocksChange(newBlocks);
  };

  const handleRightBlocksChange = (newBlocks: LayoutBlock[]) => {
    if (onRightBlocksChange) onRightBlocksChange(newBlocks);
  };

  const handleIdleLeftBlocksChange = (newBlocks: LayoutBlock[]) => {
    if (onIdleLeftBlocksChange) onIdleLeftBlocksChange(newBlocks);
  };

  const handleIdleRightBlocksChange = (newBlocks: LayoutBlock[]) => {
    if (onIdleRightBlocksChange) onIdleRightBlocksChange(newBlocks);
  };

  // Selection tracking
  const [selectedLeftBlockId, setSelectedLeftBlockId] = useState<string | null>(
    effectiveLeftBlocks[0]?.id || null
  );
  const [selectedRightBlockId, setSelectedRightBlockId] = useState<string | null>(
    effectiveRightBlocks[0]?.id || null
  );
  const [selectedIdleLeftBlockId, setSelectedIdleLeftBlockId] = useState<string | null>(null);
  const [selectedIdleRightBlockId, setSelectedIdleRightBlockId] = useState<string | null>(null);

  // Drag-and-drop state from center list to OLED panels
  const [dragState, setDragState] = useState<DragWidgetState | null>(null);

  // References to the screen HTML elements for drop hit-testing
  const screenElementsRef = useRef<Record<string, HTMLDivElement | null>>({
    'left-active': null,
    'right-active': null,
    'left-idle': null,
    'right-idle': null,
  });

  const handleRegisterScreenElement = useCallback(
    (screenKey: string, el: HTMLDivElement | null) => {
      screenElementsRef.current[screenKey] = el;
    },
    []
  );

  const dragStateRef = useRef<DragWidgetState | null>(null);

  // Initiate ghost drag from center widget catalog
  const handleStartDrag = useCallback(
    (widget: DisplayWidgetDefinition, clientX: number, clientY: number) => {
      const initialDrag: DragWidgetState = {
        widget,
        clientX,
        clientY,
        targetSide: null,
        targetX: null,
        targetY: null,
      };
      dragStateRef.current = initialDrag;
      setDragState(initialDrag);
    },
    []
  );

  const screenW = screenDimensions.width || 32;
  const screenH = screenDimensions.height || 128;

  // Quick add helper (clicks "+ Left" or "+ Right" on card)
  const handleQuickAdd = useCallback(
    (widget: DisplayWidgetDefinition, side: 'left' | 'right') => {
      const targetList = focusedScreenMode === 'active'
        ? (side === 'left' ? effectiveLeftBlocks : effectiveRightBlocks)
        : (side === 'left' ? effectiveIdleLeftBlocks : effectiveIdleRightBlocks);

      const patchedWidget = widget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = instances?.[widget.id]?.find(i => i.id === patchedWidget.instanceId);
      const { width: naturalW, height: naturalH } = getWidgetNaturalSize(widget, symbolSlices, activeInstance);

      // Find lowest occupied Y coordinate to append cleanly
      let nextY = widget.defaultPlacement.defaultY;
      const occupiedBottoms = targetList
        .filter(b => b.enabled)
        .map(b => b.y + b.height);

      if (occupiedBottoms.length > 0) {
        const maxBottom = Math.max(...occupiedBottoms);
        if (maxBottom + naturalH <= screenH) {
          nextY = maxBottom;
        } else {
          nextY = Math.max(0, screenH - naturalH);
        }
      }

      const defaultX = widget.defaultPlacement.defaultX ?? Math.max(0, Math.floor((screenW - naturalW) / 2));

      const newBlock: LayoutBlock = {
        id: `block-${widget.id}-${Date.now()}`,
        widgetType: widget.id,
        instanceId: patchedWidget.instanceId,
        name: widget.name,
        x: defaultX,
        y: nextY,
        width: naturalW,
        height: naturalH,
        enabled: true,
        description: widget.description,
        side,
      };

      if (focusedScreenMode === 'active') {
        if (side === 'left') {
          handleLeftBlocksChange([...targetList, newBlock]);
          setSelectedLeftBlockId(newBlock.id);
          setSelectedRightBlockId(null);
        } else {
          handleRightBlocksChange([...targetList, newBlock]);
          setSelectedRightBlockId(newBlock.id);
          setSelectedLeftBlockId(null);
        }
      } else {
        if (side === 'left') {
          handleIdleLeftBlocksChange([...targetList, newBlock]);
          setSelectedIdleLeftBlockId(newBlock.id);
          setSelectedIdleRightBlockId(null);
        } else {
          handleIdleRightBlocksChange([...targetList, newBlock]);
          setSelectedIdleRightBlockId(newBlock.id);
          setSelectedIdleLeftBlockId(null);
        }
      }
    },
    [focusedScreenMode, effectiveLeftBlocks, effectiveRightBlocks, effectiveIdleLeftBlocks, effectiveIdleRightBlocks, symbolSlices, instances, screenW, screenH]
  );

  // Window listeners during active ghost drag
  const isDragging = dragState !== null;
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;

      let targetSide: 'left' | 'right' | null = null;
      let targetX: number | null = null;
      let targetY: number | null = null;

      const currentWidget = dragStateRef.current?.widget;
      if (!currentWidget) return;

      const patchedWidget = currentWidget as DisplayWidgetDefinition & { instanceId?: string };
      const activeInstance = instances?.[currentWidget.id]?.find(i => i.id === patchedWidget.instanceId);
      const naturalSize = getWidgetNaturalSize(currentWidget, symbolSlices, activeInstance);

      // Hit-test targeting the active/focused screens
      const targetScreenSuffix = focusedScreenMode;
      const leftEl = screenElementsRef.current[`left-${targetScreenSuffix}`];
      const rightEl = screenElementsRef.current[`right-${targetScreenSuffix}`];

      if (leftEl) {
        const rect = leftEl.getBoundingClientRect();
        if (
          clientX >= rect.left - 40 &&
          clientX <= rect.right + 40 &&
          clientY >= rect.top - 20 &&
          clientY <= rect.bottom + 20
        ) {
          targetSide = 'left';
          const relX = Math.round(
            ((clientX - rect.left) / rect.width) * screenW - naturalSize.width / 2
          );
          const relY = Math.round(
            ((clientY - rect.top) / rect.height) * screenH - naturalSize.height / 2
          );
          targetX = Math.max(0, Math.min(screenW - naturalSize.width, relX));
          targetY = Math.max(0, Math.min(screenH - naturalSize.height, relY));
        }
      }

      if (!targetSide && rightEl) {
        const rect = rightEl.getBoundingClientRect();
        if (
          clientX >= rect.left - 40 &&
          clientX <= rect.right + 40 &&
          clientY >= rect.top - 20 &&
          clientY <= rect.bottom + 20
        ) {
          targetSide = 'right';
          const relX = Math.round(
            ((clientX - rect.left) / rect.width) * screenW - naturalSize.width / 2
          );
          const relY = Math.round(
            ((clientY - rect.top) / rect.height) * screenH - naturalSize.height / 2
          );
          targetX = Math.max(0, Math.min(screenW - naturalSize.width, relX));
          targetY = Math.max(0, Math.min(screenH - naturalSize.height, relY));
        }
      }

      const updatedState: DragWidgetState = {
        widget: currentWidget,
        clientX,
        clientY,
        targetSide,
        targetX,
        targetY,
      };
      dragStateRef.current = updatedState;
      setDragState(updatedState);
    };

    const handlePointerEnd = () => {
      const active = dragStateRef.current;
      if (active && active.targetSide && active.targetY !== null) {
        const side = active.targetSide;
        const patchedWidget = active.widget as DisplayWidgetDefinition & { instanceId?: string };
        const activeInstance = instances?.[active.widget.id]?.find(i => i.id === patchedWidget.instanceId);
        const { width: naturalW, height: naturalH } = getWidgetNaturalSize(active.widget, symbolSlices, activeInstance);
        const newBlock: LayoutBlock = {
          id: `block-${active.widget.id}-${Date.now()}`,
          widgetType: active.widget.id,
          instanceId: patchedWidget.instanceId,
          name: active.widget.name,
          x: active.targetX ?? (active.widget.defaultPlacement.defaultX ?? 0),
          y: active.targetY,
          width: naturalW,
          height: naturalH,
          enabled: true,
          description: active.widget.description,
          side,
        };

        if (focusedScreenMode === 'active') {
          if (side === 'left') {
            handleLeftBlocksChange([...effectiveLeftBlocks, newBlock]);
            setSelectedLeftBlockId(newBlock.id);
            setSelectedRightBlockId(null);
          } else {
            handleRightBlocksChange([...effectiveRightBlocks, newBlock]);
            setSelectedRightBlockId(newBlock.id);
            setSelectedLeftBlockId(null);
          }
        } else {
          if (side === 'left') {
            handleIdleLeftBlocksChange([...effectiveIdleLeftBlocks, newBlock]);
            setSelectedIdleLeftBlockId(newBlock.id);
            setSelectedIdleRightBlockId(null);
          } else {
            handleIdleRightBlocksChange([...effectiveIdleRightBlocks, newBlock]);
            setSelectedIdleRightBlockId(newBlock.id);
            setSelectedIdleLeftBlockId(null);
          }
        }
      }

      dragStateRef.current = null;
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isDragging, focusedScreenMode, effectiveLeftBlocks, effectiveRightBlocks, effectiveIdleLeftBlocks, effectiveIdleRightBlocks, symbolSlices, instances, screenW, screenH]);

  // Active Screen Action Handlers
  const handleResetLeft = () => {
    handleLeftBlocksChange([...DEFAULT_LEFT_LAYOUT_BLOCKS]);
    setSelectedLeftBlockId(DEFAULT_LEFT_LAYOUT_BLOCKS[0]?.id || null);
    setSelectedRightBlockId(null);
  };

  const handleResetRight = () => {
    handleRightBlocksChange([...DEFAULT_RIGHT_LAYOUT_BLOCKS]);
    setSelectedRightBlockId(DEFAULT_RIGHT_LAYOUT_BLOCKS[0]?.id || null);
    setSelectedLeftBlockId(null);
  };

  const handleClearLeft = () => {
    handleLeftBlocksChange([]);
    setSelectedLeftBlockId(null);
  };

  const handleClearRight = () => {
    handleRightBlocksChange([]);
    setSelectedRightBlockId(null);
  };

  const handleMirrorToRight = () => {
    const mirrored: LayoutBlock[] = effectiveLeftBlocks.map(b => ({
      ...b,
      id: `block-${b.widgetType || b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      side: 'right',
    }));
    handleRightBlocksChange(mirrored);
    setSelectedRightBlockId(mirrored[0]?.id || null);
    setSelectedLeftBlockId(null);
  };

  const handleMirrorToLeft = () => {
    const mirrored: LayoutBlock[] = effectiveRightBlocks.map(b => ({
      ...b,
      id: `block-${b.widgetType || b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      side: 'left',
    }));
    handleLeftBlocksChange(mirrored);
    setSelectedLeftBlockId(mirrored[0]?.id || null);
    setSelectedRightBlockId(null);
  };

  // Idle Screen Action Handlers
  const handleResetIdleLeft = () => {
    handleIdleLeftBlocksChange([
      { id: 'idle-left-art', widgetType: 'screensaver', name: 'Mascot Image', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'left' }
    ]);
  };

  const handleResetIdleRight = () => {
    handleIdleRightBlocksChange([
      { id: 'idle-right-art', widgetType: 'screensaver', name: 'Mascot Image', x: 3, y: 35, width: 26, height: 26, enabled: true, side: 'right' }
    ]);
  };

  const handleClearIdleLeft = () => {
    handleIdleLeftBlocksChange([]);
    setSelectedIdleLeftBlockId(null);
  };

  const handleClearIdleRight = () => {
    handleIdleRightBlocksChange([]);
    setSelectedIdleRightBlockId(null);
  };

  const handleMirrorIdleToRight = () => {
    const mirrored: LayoutBlock[] = effectiveIdleLeftBlocks.map(b => ({
      ...b,
      id: `idle-block-${b.widgetType || b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      side: 'right',
    }));
    handleIdleRightBlocksChange(mirrored);
  };

  const handleMirrorIdleToLeft = () => {
    const mirrored: LayoutBlock[] = effectiveIdleRightBlocks.map(b => ({
      ...b,
      id: `idle-block-${b.widgetType || b.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      side: 'left',
    }));
    handleIdleLeftBlocksChange(mirrored);
  };

  return (
    <div className="blocks-tab-wrapper">
      <div className="blocks-tab-container">
        {/* Ghost Drag Floating Overlay attached to cursor */}
        {dragState && (
          <GhostDragOverlay
            dragState={dragState}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
          />
        )}

        {/* Column 1: Left Screens (Active + Idle Stacked) */}
        <div className={`blocks-column-oled ${focusedScreenMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
          <OledPanelColumn
            side="left"
            screenKind="active"
            title="Left Active"
            subtitle="Master Half"
            blocks={effectiveLeftBlocks}
            onBlocksChange={handleLeftBlocksChange}
            onResetDefaults={handleResetLeft}
            onClearScreen={handleClearLeft}
            onMirror={handleMirrorToRight}
            mirrorButtonLabel="Mirror to Right"
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'left' && focusedScreenMode === 'active'}
            dropTargetX={dragState?.targetSide === 'left' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'left' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedLeftBlockId}
            onSelectBlock={id => {
              setSelectedLeftBlockId(id);
              if (id) {
                setSelectedRightBlockId(null);
                setSelectedIdleLeftBlockId(null);
                setSelectedIdleRightBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            isCompact={focusedScreenMode === 'idle'}
            onExpand={() => setFocusedScreenMode('active')}
          />

          <OledPanelColumn
            side="left"
            screenKind="idle"
            title="Left Idle"
            subtitle="Sleep & Screensaver"
            blocks={effectiveIdleLeftBlocks}
            onBlocksChange={handleIdleLeftBlocksChange}
            onResetDefaults={handleResetIdleLeft}
            onClearScreen={handleClearIdleLeft}
            onMirror={handleMirrorIdleToRight}
            mirrorButtonLabel="Mirror Idle to Right"
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'left' && focusedScreenMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'left' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'left' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedIdleLeftBlockId}
            onSelectBlock={id => {
              setSelectedIdleLeftBlockId(id);
              if (id) {
                setSelectedLeftBlockId(null);
                setSelectedRightBlockId(null);
                setSelectedIdleRightBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            isCompact={focusedScreenMode === 'active'}
            onExpand={() => setFocusedScreenMode('idle')}
          />
        </div>

        {/* Column 2: Center Scrollable Widget Library Catalog */}
        <div className="blocks-column-catalog">
          <WidgetCatalogList
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            onStartDrag={handleStartDrag}
            onQuickAdd={handleQuickAdd}
          />
        </div>

        {/* Column 3: Right Screens (Active + Idle Stacked) */}
        <div className={`blocks-column-oled ${focusedScreenMode === 'active' ? 'active-expanded' : 'idle-expanded'}`}>
          <OledPanelColumn
            side="right"
            screenKind="active"
            title="Right Active"
            subtitle="Peripheral Half"
            blocks={effectiveRightBlocks}
            onBlocksChange={handleRightBlocksChange}
            onResetDefaults={handleResetRight}
            onClearScreen={handleClearRight}
            onMirror={handleMirrorToLeft}
            mirrorButtonLabel="Mirror to Left"
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'right' && focusedScreenMode === 'active'}
            dropTargetX={dragState?.targetSide === 'right' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'right' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedRightBlockId}
            onSelectBlock={id => {
              setSelectedRightBlockId(id);
              if (id) {
                setSelectedLeftBlockId(null);
                setSelectedIdleLeftBlockId(null);
                setSelectedIdleRightBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            isCompact={focusedScreenMode === 'idle'}
            onExpand={() => setFocusedScreenMode('active')}
          />

          <OledPanelColumn
            side="right"
            screenKind="idle"
            title="Right Idle"
            subtitle="Sleep & Screensaver"
            blocks={effectiveIdleRightBlocks}
            onBlocksChange={handleIdleRightBlocksChange}
            onResetDefaults={handleResetIdleRight}
            onClearScreen={handleClearIdleRight}
            onMirror={handleMirrorIdleToLeft}
            mirrorButtonLabel="Mirror Idle to Left"
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            customText={customText}
            instances={instances}
            isDropTarget={dragState?.targetSide === 'right' && focusedScreenMode === 'idle'}
            dropTargetX={dragState?.targetSide === 'right' ? dragState.targetX : null}
            dropTargetY={dragState?.targetSide === 'right' ? dragState.targetY : null}
            draggedWidget={dragState?.widget || null}
            selectedBlockId={selectedIdleRightBlockId}
            onSelectBlock={id => {
              setSelectedIdleRightBlockId(id);
              if (id) {
                setSelectedLeftBlockId(null);
                setSelectedRightBlockId(null);
                setSelectedIdleLeftBlockId(null);
              }
            }}
            onRegisterScreenElement={handleRegisterScreenElement}
            screenDimensions={screenDimensions}
            isCompact={focusedScreenMode === 'active'}
            onExpand={() => setFocusedScreenMode('idle')}
          />
        </div>
      </div>
    </div>
  );
};

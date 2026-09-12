import React, { useState, useCallback } from 'react';
import type { ShieldDefinition } from '../data/shieldsData';
import { OledDisplayModule } from './OledDisplayModule';
import { BwpxGrid } from '../bwpx/core/BwpxGrid';
import type { SpriteSlice, FontGlyph, FontCharMapping, LayoutBlock } from '../types/zmk';
import type { WidgetInstanceMap } from '../types/widget';
import { Plus } from 'lucide-react';

export interface DisplayConfigOverride {
  displayId: string | null; // null represents an empty OLED bay/socket
  displayName?: string;
  isMaster?: boolean;
  blocks?: LayoutBlock[];
  width?: number;
  height?: number;
}

export interface ShieldKeyboardGeometryProps {
  shield: ShieldDefinition;
  symbolsGrid: BwpxGrid;
  symbolSlices: SpriteSlice[];
  fontGrid: BwpxGrid;
  fontGlyphs?: FontGlyph[];
  fontMappings?: FontCharMapping[];
  activeLeftBlocks: LayoutBlock[];
  activeRightBlocks: LayoutBlock[];
  activeDongleBlocks: LayoutBlock[];
  isIdle?: boolean;
  batteryLevel?: number;
  outputMode?: 'usb' | 'ble';
  currentLayer?: number;
  typingWpm?: number;
  customText?: string;
  instances?: WidgetInstanceMap;
  compact?: boolean;
  scale?: number;
  corneColumns?: 5 | 6;
  onlySide?: 'left' | 'right';
  displayConfigOverride?: DisplayConfigOverride;
  onDisplayDragStart?: (e: React.DragEvent) => void;
  onDisplayDrop?: (e: React.DragEvent) => void;
  isDisplayDropTarget?: boolean;
  onKeystroke?: () => void;
}

export const ShieldKeyboardGeometry: React.FC<ShieldKeyboardGeometryProps> = ({
  shield,
  symbolsGrid,
  symbolSlices,
  fontGrid,
  fontGlyphs = [],
  fontMappings = [],
  activeLeftBlocks,
  activeRightBlocks,
  activeDongleBlocks,
  isIdle = false,
  batteryLevel = 88,
  outputMode = 'ble',
  currentLayer = 0,
  typingWpm = 48,
  customText = 'SCYAN',
  instances,
  compact = false,
  scale = 1,
  corneColumns = 6,
  onlySide,
  displayConfigOverride,
  onDisplayDragStart,
  onDisplayDrop,
  isDisplayDropTarget = false,
  onKeystroke,
}) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [encoderRotations, setEncoderRotations] = useState<Record<string, number>>({});

  const handleKeyClick = useCallback(
    (keyId: string) => {
      setPressedKey(keyId);
      if (onKeystroke) onKeystroke();
      setTimeout(() => {
        setPressedKey((curr) => (curr === keyId ? null : curr));
      }, 150);
    },
    [onKeystroke]
  );

  const handleEncoderClick = useCallback(
    (encoderId: string) => {
      setPressedKey(encoderId);
      setEncoderRotations((prev) => ({
        ...prev,
        [encoderId]: (prev[encoderId] || 0) + 30,
      }));
      if (onKeystroke) onKeystroke();
      setTimeout(() => {
        setPressedKey((curr) => (curr === encoderId ? null : curr));
      }, 150);
    },
    [onKeystroke]
  );

  const geom = shield.layoutGeometry;
  const keySize = compact ? 13 : Math.round(34 * scale);
  const keyGap = compact ? 2 : Math.round(5 * scale);
  const oledScale = compact ? 0.42 : scale * 0.95;

  // Ergonomic thumb rotation arc helper
  const getThumbStyle = (
    tIdx: number,
    thumbCount: number,
    isLeft: boolean,
    widthPx: number,
    heightPx: number
  ): React.CSSProperties => {
    let transform = '';
    if (!compact) {
      if (thumbCount === 3) {
        // Corne style: -4deg, 0deg, 6deg on left
        const angles = [-4, 0, 6];
        const yOffsets = [2, 0, 4];
        const angle = isLeft ? angles[tIdx] : -angles[thumbCount - 1 - tIdx];
        const y = isLeft ? yOffsets[tIdx] : yOffsets[thumbCount - 1 - tIdx];
        transform = `translateY(${Math.round(y * scale)}px) rotate(${angle}deg)`;
      } else if (thumbCount === 5) {
        // Kyria / Sofle style: curved radial thumb arc
        const angles = isLeft ? [-8, -4, 0, 5, 10] : [-10, -5, 0, 4, 8];
        const yOffsets = [5, 2, 0, 3, 7];
        const angle = angles[tIdx] || 0;
        const y = isLeft ? yOffsets[tIdx] : yOffsets[thumbCount - 1 - tIdx];
        transform = `translateY(${Math.round(y * scale)}px) rotate(${angle}deg)`;
      } else if (thumbCount === 4) {
        // Lily58 / Iris style
        const angles = isLeft ? [-5, -2, 2, 6] : [-6, -2, 2, 5];
        const yOffsets = [4, 1, 0, 3];
        const angle = angles[tIdx] || 0;
        const y = isLeft ? yOffsets[tIdx] : yOffsets[thumbCount - 1 - tIdx];
        transform = `translateY(${Math.round(y * scale)}px) rotate(${angle}deg)`;
      } else if (thumbCount === 2) {
        // Ferris Sweep style
        const angles = isLeft ? [-3, 4] : [-4, 3];
        const yOffsets = [1, 2];
        const angle = angles[tIdx] || 0;
        const y = isLeft ? yOffsets[tIdx] : yOffsets[thumbCount - 1 - tIdx];
        transform = `translateY(${Math.round(y * scale)}px) rotate(${angle}deg)`;
      }
    }

    return {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      transform: transform || undefined,
    };
  };

  // Helper to render a blank keycap
  const renderBlankKey = (
    keyId: string,
    widthPx: number = keySize,
    heightPx: number = keySize,
    isHoming: boolean = false,
    className: string = 'shield-blank-keycap',
    styleOverride?: React.CSSProperties
  ) => {
    const isPressed = pressedKey === keyId;
    return (
      <div
        key={keyId}
        role="button"
        tabIndex={0}
        data-keycap="blank"
        className={`${className} ${compact ? 'compact' : ''} ${isPressed ? 'pressed' : ''}`}
        style={{
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          ...styleOverride,
        }}
        onClick={() => handleKeyClick(keyId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleKeyClick(keyId);
          }
        }}
        title="Blank Keycap (Aesthetic Hardware Preview)"
      >
        {isHoming && !compact && <span className="shield-homing-bump" />}
      </div>
    );
  };

  // Helper to render rotary encoder knob
  const renderEncoderKnob = (encoderId: string, sizePx: number = Math.round(30 * scale)) => {
    const rot = encoderRotations[encoderId] || 0;
    const isPressed = pressedKey === encoderId;
    const knobSize = compact ? 18 : sizePx;
    return (
      <div
        key={encoderId}
        role="button"
        tabIndex={0}
        data-encoder="rotary"
        className={`shield-encoder-knob ${isPressed ? 'pressed' : ''}`}
        style={{
          width: `${knobSize}px`,
          height: `${knobSize}px`,
          transform: `rotate(${rot}deg)`,
        }}
        onClick={() => handleEncoderClick(encoderId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEncoderClick(encoderId);
          }
        }}
        title="EC11 Rotary Encoder (Click to rotate)"
      >
        <div className="encoder-indicator-notch" />
      </div>
    );
  };

  // Helper to render OLED Bay (either populated with assigned display or empty socket)
  const renderOledBay = (
    defaultBlocks: LayoutBlock[],
    defaultSide: 'left' | 'right' | 'dongle' | 'single' = 'left',
    customOledScale: number = oledScale
  ) => {
    const defaultW = shield.displayConfig.nativeResolution.width;
    const defaultH = shield.displayConfig.nativeResolution.height;

    // Check if displayConfigOverride was passed
    if (displayConfigOverride !== undefined) {
      if (displayConfigOverride.displayId === null) {
        // Empty OLED Bay / Socket
        const socketW = Math.round(defaultW * customOledScale);
        const socketH = Math.round(defaultH * customOledScale);
        return (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDisplayDrop?.(e);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              isDisplayDropTarget
                ? 'border-[#00f0ff] bg-[#00f0ff]/15 shadow-[0_0_20px_rgba(0,240,255,0.35)] scale-105'
                : 'border-[#1e2538] hover:border-[#00f0ff]/50 bg-[#0b0e17]/80 hover:bg-[#131724]/90'
            }`}
            style={{
              width: `${Math.max(36, socketW)}px`,
              height: `${Math.max(64, socketH)}px`,
            }}
            title="Empty OLED Bay — Drag an OLED display here to mount it on this shield"
          >
            <div className="size-6 rounded-lg bg-[#141824] flex items-center justify-center text-[#64748b] mb-1">
              <Plus size={14} />
            </div>
            <span className="text-[8px] font-mono text-[#64748b] text-center px-1 leading-tight select-none">
              Empty OLED
            </span>
          </div>
        );
      }

      // Display is assigned
      const effBlocks = displayConfigOverride.blocks ?? defaultBlocks;
      const effSide = displayConfigOverride.isMaster ? 'left' : defaultSide;
      const effW = displayConfigOverride.width ?? defaultW;
      const effH = displayConfigOverride.height ?? defaultH;

      return (
        <div
          draggable={!!onDisplayDragStart}
          onDragStart={(e) => {
            e.stopPropagation();
            onDisplayDragStart?.(e);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDisplayDrop?.(e);
          }}
          className={`relative group/display cursor-grab active:cursor-grabbing rounded-xl transition-all ${
            isDisplayDropTarget
              ? 'ring-2 ring-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.5)] scale-102'
              : 'hover:ring-1 hover:ring-[#00f0ff]/50'
          }`}
          title={`${displayConfigOverride.displayName || 'Display'} (Drag to swap or move to another shield)`}
        >
          {onDisplayDragStart && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/display:opacity-100 transition-opacity z-20 pointer-events-none bg-[#0a0d14]/95 border border-[#00f0ff]/40 text-[#00f0ff] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
              Drag Display
            </div>
          )}
          <OledDisplayModule
            width={effW}
            height={effH}
            blocks={effBlocks}
            symbolsGrid={symbolsGrid}
            symbolSlices={symbolSlices}
            fontGrid={fontGrid}
            fontGlyphs={fontGlyphs}
            fontMappings={fontMappings}
            side={effSide}
            isIdle={isIdle}
            battery={batteryLevel}
            outputMode={outputMode}
            currentLayer={currentLayer}
            wpm={typingWpm}
            customText={customText}
            instances={instances}
            showHousing={true}
            scale={customOledScale}
          />
        </div>
      );
    }

    // Default fallback
    return (
      <OledDisplayModule
        width={defaultW}
        height={defaultH}
        blocks={defaultBlocks}
        symbolsGrid={symbolsGrid}
        symbolSlices={symbolSlices}
        fontGrid={fontGrid}
        fontGlyphs={fontGlyphs}
        fontMappings={fontMappings}
        side={defaultSide}
        isIdle={isIdle}
        battery={batteryLevel}
        outputMode={outputMode}
        currentLayer={currentLayer}
        wpm={typingWpm}
        customText={customText}
        instances={instances}
        showHousing={true}
        scale={customOledScale}
      />
    );
  };

  // ==========================================
  // TYPE 1: SPLIT-PAIR KEYBOARDS
  // ==========================================
  if (geom.type === 'split-pair') {
    const isCorne = shield.id === 'corne';
    const effectiveCols = isCorne && corneColumns === 5 ? 5 : geom.columns;
    const colStaggers =
      isCorne && corneColumns === 5
        ? geom.columnStaggers.slice(1) // omit outer 6th col
        : geom.columnStaggers;

    const renderHalf = (side: 'left' | 'right') => {
      const isLeft = side === 'left';
      const blocks = isLeft ? activeLeftBlocks : activeRightBlocks;

      // Column order: on right half, mirror order (inner columns face center)
      const colIndices = Array.from({ length: effectiveCols }, (_, i) =>
        isLeft ? i : effectiveCols - 1 - i
      );

      // Render Matrix Columns
      const matrixElement = (
        <div className="flex items-start" style={{ gap: `${keyGap}px` }}>
          {colIndices.map((origColIdx) => {
            const staggerY = (colStaggers[origColIdx] || 0) * (compact ? 0.35 : scale);

            return (
              <div
                key={`col-${origColIdx}`}
                className="flex flex-col"
                style={{
                  gap: `${keyGap}px`,
                  transform: `translateY(${staggerY}px)`,
                }}
              >
                {Array.from({ length: geom.rows }, (_, rowIdx) => {
                  const keyId = `${side}_${origColIdx}_${rowIdx}`;
                  // Homing bump on index finger (Col 4, home row)
                  const isHoming =
                    origColIdx === (effectiveCols >= 6 ? 4 : 3) &&
                    rowIdx === (geom.rows === 4 ? 2 : 1);
                  return renderBlankKey(keyId, keySize, keySize, isHoming);
                })}
              </div>
            );
          })}
        </div>
      );

      // Render Thumb Cluster aligned with inner side of the hand
      const thumbCount = geom.thumbCount;
      const matrixWidth = effectiveCols * keySize + (effectiveCols - 1) * keyGap;

      const keysCluster = (
        <div className="flex flex-col items-start" style={{ width: `${matrixWidth}px` }}>
          {matrixElement}
          <div
            className={`flex items-center mt-2.5 w-full ${isLeft ? 'justify-end' : 'justify-start'}`}
            style={{ gap: `${keyGap}px` }}
          >
            {Array.from({ length: thumbCount }, (_, tIdx) => {
              const thumbKeyId = `${side}_thumb_${tIdx}`;
              // Give Kyria outer thumb extra width (1.35u), standard thumbs ~1.05u
              const isKyriaOuter = shield.id === 'kyria' && tIdx === (isLeft ? 0 : thumbCount - 1);
              const thumbW = isKyriaOuter
                ? Math.round(keySize * 1.35)
                : Math.round(keySize * 1.05);
              const thumbH = Math.round(keySize * 0.95);
              const thumbStyle = getThumbStyle(tIdx, thumbCount, isLeft, thumbW, thumbH);
              return renderBlankKey(
                thumbKeyId,
                thumbW,
                thumbH,
                false,
                'shield-blank-thumb',
                thumbStyle
              );
            })}
          </div>
        </div>
      );

      // OLED Bay
      const oledDisplay = (
        <div className="corne-mcu-bay shrink-0">
          {renderOledBay(blocks, side)}
        </div>
      );

      // Assemble Half Layout based on OLED mount
      if (geom.oledMount === 'inner-vertical') {
        // Corne, Ferris Sweep: [Keys] [OLED] on Left, [OLED] [Keys] on Right
        return (
          <div className={`shield-half-case ${side}-half ${compact ? 'compact' : ''}`}>
            <div
              className={`flex items-start ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}
              style={{ gap: `${compact ? 6 : Math.round(12 * scale)}px` }}
            >
              {keysCluster}
              {oledDisplay}
            </div>
          </div>
        );
      }

      if (geom.oledMount === 'top-inner-horizontal') {
        // Lily58, Sofle, Iris: Top-Inner Horizontal slot
        return (
          <div className={`shield-half-case ${side}-half ${compact ? 'compact' : ''}`}>
            {/* Top row with Horizontal OLED module and optional Rotary Encoder */}
            <div
              className={`flex items-center mb-3 ${isLeft ? 'justify-end' : 'justify-start'}`}
              style={{ gap: `${Math.round(8 * scale)}px` }}
            >
              {geom.hasEncoder && isLeft && renderEncoderKnob(`${side}_encoder`)}
              {oledDisplay}
              {geom.hasEncoder && !isLeft && renderEncoderKnob(`${side}_encoder`)}
            </div>

            {keysCluster}
          </div>
        );
      }

      // Default / Kyria inner horizontal
      return (
        <div className={`shield-half-case ${side}-half ${compact ? 'compact' : ''}`}>
          <div
            className={`flex items-start ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}
            style={{ gap: `${compact ? 6 : Math.round(12 * scale)}px` }}
          >
            {keysCluster}
            <div className="flex flex-col items-center gap-2">
              {oledDisplay}
              {geom.hasEncoder && renderEncoderKnob(`${side}_encoder`)}
            </div>
          </div>
        </div>
      );
    };

    if (onlySide) {
      return (
        <div className={`shield-sandbox-container ${compact ? 'compact' : ''}`}>
          <div className={`shield-split-wrapper ${compact ? 'compact' : ''}`}>
            {renderHalf(onlySide)}
          </div>
        </div>
      );
    }

    return (
      <div className={`shield-sandbox-container ${compact ? 'compact' : ''}`}>
        <div className={`shield-split-wrapper ${compact ? 'compact' : ''}`}>
          {renderHalf('left')}
          {renderHalf('right')}
        </div>
      </div>
    );
  }

  // ==========================================
  // TYPE 2: UNIBODY KEYBOARDS (Reviung41, Reviung34)
  // ==========================================
  if (geom.type === 'unibody') {
    const angle = geom.angle || 12;
    const cols = geom.columns;
    const isTopCenterOled = geom.oledMount === 'top-center';

    const leftCluster = (
      <div
        className="flex items-start"
        style={{
          gap: `${keyGap}px`,
          transform: `rotate(${angle}deg)`,
          transformOrigin: 'bottom right',
        }}
      >
        {Array.from({ length: cols }, (_, cIdx) => {
          const staggerY = (geom.columnStaggers[cIdx] || 0) * (compact ? 0.35 : scale);
          return (
            <div
              key={`l-col-${cIdx}`}
              className="flex flex-col"
              style={{
                gap: `${keyGap}px`,
                transform: `translateY(${staggerY}px)`,
              }}
            >
              {Array.from({ length: geom.rows }, (_, rIdx) => {
                const keyId = `uni_left_${cIdx}_${rIdx}`;
                const isHoming = cIdx === cols - 2 && rIdx === 1;
                return renderBlankKey(keyId, keySize, keySize, isHoming);
              })}
            </div>
          );
        })}
      </div>
    );

    const rightCluster = (
      <div
        className="flex items-start"
        style={{
          gap: `${keyGap}px`,
          transform: `rotate(-${angle}deg)`,
          transformOrigin: 'bottom left',
        }}
      >
        {Array.from({ length: cols }, (_, cIdx) => {
          const origColIdx = cols - 1 - cIdx;
          const staggerY =
            (geom.columnStaggers[origColIdx] || 0) * (compact ? 0.35 : scale);
          return (
            <div
              key={`r-col-${cIdx}`}
              className="flex flex-col"
              style={{
                gap: `${keyGap}px`,
                transform: `translateY(${staggerY}px)`,
              }}
            >
              {Array.from({ length: geom.rows }, (_, rIdx) => {
                const keyId = `uni_right_${origColIdx}_${rIdx}`;
                const isHoming = origColIdx === cols - 2 && rIdx === 1;
                return renderBlankKey(keyId, keySize, keySize, isHoming);
              })}
            </div>
          );
        })}
      </div>
    );

    const oledDisplay = (
      <div className="flex flex-col items-center justify-center shrink-0 z-10">
        {renderOledBay(activeLeftBlocks, 'single')}
      </div>
    );

    const thumbCluster = (
      <div
        className="flex items-center justify-center mt-2"
        style={{ gap: `${keyGap}px` }}
      >
        {Array.from({ length: geom.thumbCount }, (_, tIdx) => {
          const thumbKeyId = `uni_thumb_${tIdx}`;
          // For Reviung41: center thumb (index 2) is a 2.25u wide spacebar!
          const isCenterSpace = shield.id === 'reviung41' && tIdx === 2;
          const thumbW = isCenterSpace
            ? Math.round(keySize * 2.25)
            : Math.round(keySize * 1.15);
          const thumbH = Math.round(keySize * 0.95);
          return renderBlankKey(thumbKeyId, thumbW, thumbH, false, 'shield-blank-thumb');
        })}
      </div>
    );

    return (
      <div className={`shield-sandbox-container ${compact ? 'compact' : ''}`}>
        <div className={`shield-unibody-case ${compact ? 'compact' : ''}`}>
          {isTopCenterOled ? (
            /* Reviung34: Top Center OLED above clusters */
            <>
              <div className="my-1">{oledDisplay}</div>
              <div
                className="flex items-center justify-center relative my-1"
                style={{ gap: `${compact ? 8 : Math.round(14 * scale)}px` }}
              >
                {leftCluster}
                {rightCluster}
              </div>
              {thumbCluster}
            </>
          ) : (
            /* Reviung41: Central Diamond Notch OLED between clusters */
            <>
              <div
                className="flex items-center justify-center relative my-2"
                style={{ gap: `${compact ? 10 : Math.round(20 * scale)}px` }}
              >
                {leftCluster}
                {oledDisplay}
                {rightCluster}
              </div>
              {thumbCluster}
            </>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // TYPE 3: DONGLE ENCLOSURE (Seeed XIAO Dongle)
  // ==========================================
  if (geom.type === 'dongle') {
    return (
      <div className={`shield-sandbox-container ${compact ? 'compact' : ''}`}>
        <div className={`dongle-unit-case ${compact ? 'compact' : ''}`}>
          {/* USB-A Connector */}
          <div className="dongle-usb-connector">
            <div className="dongle-usb-metal">
              <div className="dongle-usb-pin" />
              <div className="dongle-usb-pin" />
            </div>
          </div>

          {/* Dongle Body with Central Vertical OLED */}
          <div className="dongle-body">
            <div className="dongle-header-badge">
              <span className="live-dot" />
              <span>Central Dongle Master</span>
            </div>

            {renderOledBay(activeDongleBlocks, 'dongle', oledScale * 1.05)}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TYPE 4: NUMPAD / MACROPAD (Tidbit 19-key)
  // ==========================================
  if (geom.type === 'numpad') {
    return (
      <div className={`shield-sandbox-container ${compact ? 'compact' : ''}`}>
        <div className={`shield-numpad-case ${compact ? 'compact' : ''}`}>
          {/* Top Header Row: 128x32 OLED Display + Rotary Encoder */}
          <div
            className="flex items-center justify-between w-full mb-1"
            style={{ gap: `${Math.round(10 * scale)}px` }}
          >
            <div className="flex-1 flex justify-center">
              {renderOledBay(activeLeftBlocks, 'single')}
            </div>
            {geom.hasEncoder && renderEncoderKnob('tidbit_encoder')}
          </div>

          {/* 19-Key Numpad Grid: 4 columns x 5 rows */}
          <div className="flex flex-col" style={{ gap: `${keyGap}px` }}>
            {/* Rows 0 to 3: 4 keys each (16 keys) */}
            {Array.from({ length: 4 }, (_, rIdx) => (
              <div key={`num-row-${rIdx}`} className="flex items-center" style={{ gap: `${keyGap}px` }}>
                {Array.from({ length: 4 }, (_, cIdx) => {
                  const keyId = `tidbit_${rIdx}_${cIdx}`;
                  // Homing bump on 5 key (Row 2, Col 1)
                  const isHoming = rIdx === 2 && cIdx === 1;
                  return renderBlankKey(keyId, keySize, keySize, isHoming);
                })}
              </div>
            ))}

            {/* Row 4: 2u key (0), 1u (.), 1u (Enter) = 3 keys (Total: 16 + 3 = 19 keys!) */}
            <div className="flex items-center" style={{ gap: `${keyGap}px` }}>
              {renderBlankKey(
                'tidbit_4_0',
                Math.round(keySize * 2 + keyGap),
                keySize,
                false,
                'shield-blank-keycap'
              )}
              {renderBlankKey('tidbit_4_1', keySize, keySize)}
              {renderBlankKey('tidbit_4_2', keySize, keySize)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

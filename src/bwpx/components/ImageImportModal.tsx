import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BwpxGrid } from '../core/BwpxGrid';
import { convertImageElementToGrid } from '../core/imageConversion';
import { renderBwpxCanvas } from '../core/gridRenderer';
import { X, Sparkles, SlidersHorizontal, RefreshCw, Link2, Unlink2 } from 'lucide-react';
import './ImageImportModal.css';

export interface ImageImportModalProps {
  isOpen: boolean;
  imageSource: File | Blob | string | null;
  onClose: () => void;
  onConfirm: (grid: BwpxGrid, width: number, height: number) => void;
}

type ScalePreset = 'original' | 'fit-34' | 'fit-32' | 'fit-64' | 'fit-16' | 'custom';

export const ImageImportModal: React.FC<ImageImportModalProps> = ({
  isOpen,
  imageSource,
  onClose,
  onConfirm,
}) => {
  const [threshold, setThreshold] = useState<number>(128);
  const [invert, setInvert] = useState<boolean>(false);
  const [scalePreset, setScalePreset] = useState<ScalePreset>('original');
  const [customWidth, setCustomWidth] = useState<number>(0);
  const [customHeight, setCustomHeight] = useState<number>(0);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [convertedGrid, setConvertedGrid] = useState<BwpxGrid | null>(null);
  const [targetDimensions, setTargetDimensions] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [previewZoom, setPreviewZoom] = useState<number>(4);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const imageSrcRef = useRef<string | null>(null);

  // Load image element from source
  useEffect(() => {
    if (!isOpen || !imageSource) {
      setImgElement(null);
      setConvertedGrid(null);
      return;
    }

    let src = '';
    let isCreatedUrl = false;

    if (typeof imageSource === 'string') {
      src = imageSource;
    } else if (imageSource instanceof Blob) {
      src = URL.createObjectURL(imageSource);
      isCreatedUrl = true;
    }

    imageSrcRef.current = src;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      setOriginalDimensions({ w: origW, h: origH });
      setCustomWidth(origW);
      setCustomHeight(origH);
      // By default it loads original size
      setScalePreset('original');
      setImgElement(img);
    };
    img.src = src;

    return () => {
      if (isCreatedUrl) {
        URL.revokeObjectURL(src);
      }
    };
  }, [isOpen, imageSource]);

  // Calculate target dimensions based on preset and custom values
  const computeTargetSize = useCallback(
    (origW: number, origH: number, preset: ScalePreset, cW: number, cH: number) => {
      if (origW === 0 || origH === 0) return { w: 0, h: 0 };

      if (preset === 'custom') {
        return {
          w: Math.max(1, Math.min(2048, Math.round(cW || origW))),
          h: Math.max(1, Math.min(2048, Math.round(cH || origH))),
        };
      }

      let targetH = origH;
      if (preset === 'fit-34') targetH = 34;
      else if (preset === 'fit-32') targetH = 32;
      else if (preset === 'fit-64') targetH = 64;
      else if (preset === 'fit-16') targetH = 16;
      else return { w: origW, h: origH };

      const ratio = origW / origH;
      const targetW = Math.max(1, Math.round(targetH * ratio));
      return { w: targetW, h: targetH };
    },
    []
  );

  const handlePresetSelect = (newPreset: ScalePreset) => {
    setScalePreset(newPreset);
    if (newPreset !== 'custom') {
      const size = computeTargetSize(
        originalDimensions.w,
        originalDimensions.h,
        newPreset,
        customWidth,
        customHeight
      );
      setCustomWidth(size.w);
      setCustomHeight(size.h);
    }
  };

  const handleWidthChange = (val: number) => {
    const newW = Math.max(1, val);
    setCustomWidth(newW);
    setScalePreset('custom');
    if (lockAspectRatio && originalDimensions.w > 0 && originalDimensions.h > 0) {
      const ratio = originalDimensions.w / originalDimensions.h;
      const newH = Math.max(1, Math.round(newW / ratio));
      setCustomHeight(newH);
    }
  };

  const handleHeightChange = (val: number) => {
    const newH = Math.max(1, val);
    setCustomHeight(newH);
    setScalePreset('custom');
    if (lockAspectRatio && originalDimensions.w > 0 && originalDimensions.h > 0) {
      const ratio = originalDimensions.w / originalDimensions.h;
      const newW = Math.max(1, Math.round(newH * ratio));
      setCustomWidth(newW);
    }
  };

  // Update converted grid whenever threshold, invert, or sizing changes
  useEffect(() => {
    if (!imgElement || originalDimensions.w === 0) return;

    const target = computeTargetSize(
      originalDimensions.w,
      originalDimensions.h,
      scalePreset,
      customWidth,
      customHeight
    );
    setTargetDimensions(target);

    const result = convertImageElementToGrid(imgElement, {
      threshold,
      invert,
      targetWidth: target.w,
      targetHeight: target.h,
    });

    setConvertedGrid(result.grid);
  }, [
    imgElement,
    threshold,
    invert,
    scalePreset,
    customWidth,
    customHeight,
    originalDimensions,
    computeTargetSize,
  ]);

  // Center and fit preview canvas when dimensions change
  useEffect(() => {
    if (!previewContainerRef.current || targetDimensions.w === 0 || targetDimensions.h === 0) return;

    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Determine zoom so grid fits pleasantly inside container with padding
    const zoomX = (rect.width - 40) / targetDimensions.w;
    const zoomY = (rect.height - 40) / targetDimensions.h;
    const fitZoom = Math.max(1, Math.min(24, Math.floor(Math.min(zoomX, zoomY))));

    setPreviewZoom(fitZoom);
    setPreviewPan({
      x: Math.round((rect.width - targetDimensions.w * fitZoom) / 2),
      y: Math.round((rect.height - targetDimensions.h * fitZoom) / 2),
    });
  }, [targetDimensions]);

  // Render preview canvas using shared gridRenderer
  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !convertedGrid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderBwpxCanvas(canvas, ctx, {
      grid: convertedGrid,
      zoom: previewZoom,
      pan: previewPan,
      pixelColor: '#00d2ff',
      bgColor: '#0b0d11',
      showAxes: false,
      showGridLines: previewZoom >= 4,
      frameBounds: {
        x: 0,
        y: 0,
        w: targetDimensions.w,
        h: targetDimensions.h,
      },
    });
  }, [convertedGrid, previewZoom, previewPan, targetDimensions]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Auto-resize canvas element to match container
  useEffect(() => {
    const updateSize = () => {
      if (previewContainerRef.current && canvasRef.current) {
        const w = previewContainerRef.current.clientWidth;
        const h = previewContainerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
          renderPreview();
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [renderPreview]);

  // Handle keyboard shortcuts (Escape to close, Enter to confirm)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (convertedGrid && targetDimensions.w > 0) {
          onConfirm(convertedGrid, targetDimensions.w, targetDimensions.h);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, convertedGrid, targetDimensions, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="image-import-backdrop" onClick={onClose}>
      <div className="image-import-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="image-import-header">
          <h3 className="image-import-title">
            <SlidersHorizontal size={15} />
            <span>Tune & Import Image</span>
          </h3>
          <div className="flex items-center gap-3">
            {originalDimensions.w > 0 && (
              <span className="image-import-size-badge">
                {targetDimensions.w}×{targetDimensions.h} px
              </span>
            )}
            <button
              onClick={onClose}
              className="image-import-close"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Body: Side-by-side view */}
        <div className="image-import-body">
          <div className="image-import-previews">
            {/* Left: Original Reference */}
            <div className="image-import-panel">
              <div className="image-import-panel-header">
                <span>Reference (Original)</span>
                <strong>
                  {originalDimensions.w}×{originalDimensions.h} px
                </strong>
              </div>
              <div className="image-import-original-view">
                {imageSrcRef.current ? (
                  <img
                    src={imageSrcRef.current}
                    alt="Original Reference"
                    className="image-import-original-img"
                  />
                ) : (
                  <div className="text-xs text-slate-500">Loading original...</div>
                )}
              </div>
            </div>

            {/* Right: 1bpp Grid Preview (reusing BwpxGrid render code) */}
            <div className="image-import-panel">
              <div className="image-import-panel-header">
                <span>1bpp Monochrome Preview</span>
                <strong>
                  {convertedGrid ? `${convertedGrid.countOn()} pixels lit` : '--'}
                </strong>
              </div>
              <div ref={previewContainerRef} className="image-import-grid-view">
                <canvas ref={canvasRef} className="image-import-grid-canvas" />
              </div>
            </div>
          </div>

          {/* Tuning Controls */}
          <div className="image-import-controls">
            {/* Threshold Slider */}
            <div className="image-import-control-row">
              <label className="image-import-control-label">
                <span>Threshold</span>
                <span className="text-slate-400">0-255</span>
              </label>
              <div className="image-import-slider-container">
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="image-import-slider"
                />
                <span className="image-import-slider-val">{threshold}</span>
              </div>
            </div>

            {/* Invert & Sizing Options */}
            <div className="image-import-options-row">
              <button
                type="button"
                onClick={() => setInvert(prev => !prev)}
                className={`image-import-toggle-btn ${invert ? 'active' : ''}`}
                title="Invert 1bpp black and white pixels"
              >
                <RefreshCw size={12} />
                <span>Invert Pixels</span>
              </button>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <span className="text-xs font-mono text-slate-400">Scale:</span>
                <select
                  value={scalePreset}
                  onChange={e => handlePresetSelect(e.target.value as ScalePreset)}
                  className="image-import-select"
                >
                  <option value="original">Original ({originalDimensions.w}×{originalDimensions.h})</option>
                  <option value="fit-34">Fit Height: 34px (ZMK Symbols)</option>
                  <option value="fit-32">Fit Height: 32px (Corne HW)</option>
                  <option value="fit-64">Fit Height: 64px</option>
                  <option value="fit-16">Fit Height: 16px</option>
                  <option value="custom">Custom Resolution</option>
                </select>

                <div className="image-import-dimension-inputs">
                  <span className="image-import-dim-label">W</span>
                  <input
                    type="number"
                    min="1"
                    max="1024"
                    value={customWidth || targetDimensions.w || ''}
                    onChange={e => handleWidthChange(Number(e.target.value))}
                    className="image-import-num-input"
                    title="Custom width in pixels"
                  />
                  <button
                    type="button"
                    onClick={() => setLockAspectRatio(prev => !prev)}
                    className={`image-import-aspect-btn ${lockAspectRatio ? 'active' : ''}`}
                    title={lockAspectRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  >
                    {lockAspectRatio ? <Link2 size={12} /> : <Unlink2 size={12} />}
                  </button>
                  <span className="image-import-dim-label">H</span>
                  <input
                    type="number"
                    min="1"
                    max="1024"
                    value={customHeight || targetDimensions.h || ''}
                    onChange={e => handleHeightChange(Number(e.target.value))}
                    className="image-import-num-input"
                    title="Custom height in pixels"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="image-import-footer">
          <span className="image-import-hint">
            Confirm to add as ghost drag on canvas without altering existing drawings.
          </span>
          <div className="image-import-actions">
            <button onClick={onClose} className="image-import-btn-cancel">
              Cancel (Esc)
            </button>
            <button
              onClick={() => {
                if (convertedGrid && targetDimensions.w > 0) {
                  onConfirm(convertedGrid, targetDimensions.w, targetDimensions.h);
                }
              }}
              disabled={!convertedGrid}
              className="image-import-btn-confirm"
            >
              <Sparkles size={13} />
              <span>Place on Canvas (Enter)</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

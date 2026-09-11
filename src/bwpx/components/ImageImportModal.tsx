import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BwpxGrid } from '../core/BwpxGrid';
import { convertImageElementToGrid } from '../core/imageConversion';
import { renderBwpxCanvas } from '../core/gridRenderer';
import {
  isGifBuffer,
  decodeGif,
  convertGifFramesToGrids,
  type DecodedGif,
  type ConvertedGifFrame,
} from '../core/gifDecoder';
import { trackEvent } from '../../services/analytics';
import {
  X,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  Link2,
  Unlink2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Film,
  Crop,
} from 'lucide-react';
import './ImageImportModal.css';

export interface ImageImportModalProps {
  isOpen: boolean;
  imageSource: File | Blob | string | null;
  onClose: () => void;
  onConfirm: (
    grid: BwpxGrid,
    width: number,
    height: number,
    gifData?: {
      frames: { grid: BwpxGrid; delayMs: number }[];
      name?: string;
    }
  ) => void;
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

  // GIF animation states
  const [decodedGif, setDecodedGif] = useState<DecodedGif | null>(null);
  const [gifFrames, setGifFrames] = useState<ConvertedGifFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [imageFileName, setImageFileName] = useState<string>('');

  // Crop rectangle state (in original image coordinates)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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
  const refCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const imageSrcRef = useRef<string | null>(null);

  // Load image or GIF element from source
  useEffect(() => {
    if (!isOpen || !imageSource) {
      setImgElement(null);
      setDecodedGif(null);
      setGifFrames([]);
      setConvertedGrid(null);
      setImageFileName('');
      setCropRect(null);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;

    const loadSource = async () => {
      let fileName = 'Anim';
      let buffer: ArrayBuffer | null = null;
      let src = '';

      if (imageSource instanceof File) {
        fileName = imageSource.name.replace(/\.[^/.]+$/, '');
        setImageFileName(fileName);
        try {
          const slice = await imageSource.slice(0, 6).arrayBuffer();
          if (isGifBuffer(slice)) {
            buffer = await imageSource.arrayBuffer();
          }
        } catch (e) {
          console.warn('Error reading file buffer:', e);
        }
        src = URL.createObjectURL(imageSource);
        createdUrl = src;
      } else if (imageSource instanceof Blob) {
        setImageFileName('GIF Anim');
        try {
          const slice = await imageSource.slice(0, 6).arrayBuffer();
          if (isGifBuffer(slice)) {
            buffer = await imageSource.arrayBuffer();
          }
        } catch (e) {
          console.warn('Error reading blob buffer:', e);
        }
        src = URL.createObjectURL(imageSource);
        createdUrl = src;
      } else if (typeof imageSource === 'string') {
        src = imageSource;
        setImageFileName('Imported Image');
        if (imageSource.startsWith('data:image/gif') || imageSource.toLowerCase().includes('.gif')) {
          try {
            const res = await fetch(imageSource);
            const ab = await res.arrayBuffer();
            if (isGifBuffer(ab)) {
              buffer = ab;
            }
          } catch (e) {
            console.warn('Error fetching gif url buffer:', e);
          }
        }
      }

      if (!isMounted) {
        if (createdUrl) URL.revokeObjectURL(createdUrl);
        return;
      }

      imageSrcRef.current = src;

      // If recognized as a valid GIF
      if (buffer) {
        try {
          const decoded = decodeGif(buffer);
          if (decoded.frames.length > 0) {
            setDecodedGif(decoded);
            setImgElement(null);
            setOriginalDimensions({ w: decoded.width, h: decoded.height });
            setCropRect({ x: 0, y: 0, w: decoded.width, h: decoded.height });
            setCustomWidth(decoded.width);
            setCustomHeight(decoded.height);
            setScalePreset('original');
            setCurrentFrameIndex(0);
            setIsPlaying(true);
            return;
          }
        } catch (e) {
          console.warn('Failed to decode GIF, falling back to standard image loader:', e);
        }
      }

      // Non-GIF image fallback
      setDecodedGif(null);
      setGifFrames([]);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!isMounted) return;
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        setOriginalDimensions({ w: origW, h: origH });
        setCropRect({ x: 0, y: 0, w: origW, h: origH });
        setCustomWidth(origW);
        setCustomHeight(origH);
        setScalePreset('original');
        setImgElement(img);
      };
      img.src = src;
    };

    loadSource();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
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

  const baseW = cropRect ? cropRect.w : originalDimensions.w;
  const baseH = cropRect ? cropRect.h : originalDimensions.h;

  const handlePresetSelect = (newPreset: ScalePreset) => {
    setScalePreset(newPreset);
    if (newPreset !== 'custom') {
      const size = computeTargetSize(
        baseW,
        baseH,
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
    if (lockAspectRatio && baseW > 0 && baseH > 0) {
      const ratio = baseW / baseH;
      const newH = Math.max(1, Math.round(newW / ratio));
      setCustomHeight(newH);
    }
  };

  const handleHeightChange = (val: number) => {
    const newH = Math.max(1, val);
    setCustomHeight(newH);
    setScalePreset('custom');
    if (lockAspectRatio && baseW > 0 && baseH > 0) {
      const ratio = baseW / baseH;
      const newW = Math.max(1, Math.round(newH * ratio));
      setCustomWidth(newW);
    }
  };

  // Update converted grid whenever threshold, invert, crop, or sizing changes
  useEffect(() => {
    if (originalDimensions.w === 0 || originalDimensions.h === 0) return;

    const curBaseW = cropRect ? cropRect.w : originalDimensions.w;
    const curBaseH = cropRect ? cropRect.h : originalDimensions.h;

    const target = computeTargetSize(
      curBaseW,
      curBaseH,
      scalePreset,
      customWidth,
      customHeight
    );
    setTargetDimensions(target);

    const cropOption = cropRect
      ? { x: cropRect.x, y: cropRect.y, width: cropRect.w, height: cropRect.h }
      : undefined;

    if (decodedGif) {
      const frames = convertGifFramesToGrids(decodedGif, {
        threshold,
        invert,
        targetWidth: target.w,
        targetHeight: target.h,
        crop: cropOption,
      });
      setGifFrames(frames);
      const activeIdx = Math.min(currentFrameIndex, frames.length - 1);
      setConvertedGrid(frames[activeIdx]?.grid || frames[0]?.grid || null);
    } else if (imgElement) {
      const result = convertImageElementToGrid(imgElement, {
        threshold,
        invert,
        targetWidth: target.w,
        targetHeight: target.h,
        crop: cropOption,
      });
      setConvertedGrid(result.grid);
    }
  }, [
    decodedGif,
    imgElement,
    threshold,
    invert,
    scalePreset,
    customWidth,
    customHeight,
    originalDimensions,
    cropRect,
    computeTargetSize,
  ]);

  // GIF animation playback timer
  useEffect(() => {
    if (!decodedGif || gifFrames.length <= 1 || !isPlaying) return;

    const currentFrame = gifFrames[currentFrameIndex] || gifFrames[0];
    const delay = Math.max(20, currentFrame?.delayMs || 100);

    const timer = window.setTimeout(() => {
      const nextIdx = (currentFrameIndex + 1) % gifFrames.length;
      setCurrentFrameIndex(nextIdx);
      setConvertedGrid(gifFrames[nextIdx]?.grid || null);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [decodedGif, gifFrames, isPlaying, currentFrameIndex]);

  // Render original reference canvas for GIF frames in lockstep
  useEffect(() => {
    if (!decodedGif || !refCanvasRef.current) return;
    const canvas = refCanvasRef.current;
    const frame = decodedGif.frames[currentFrameIndex] || decodedGif.frames[0];
    if (!frame) return;

    if (canvas.width !== decodedGif.width) canvas.width = decodedGif.width;
    if (canvas.height !== decodedGif.height) canvas.height = decodedGif.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData =
      typeof ImageData !== 'undefined'
        ? new ImageData(frame.rgba as any, decodedGif.width, decodedGif.height)
        : ({ data: frame.rgba, width: decodedGif.width, height: decodedGif.height, colorSpace: 'srgb' } as ImageData);

    ctx.putImageData(imgData, 0, 0);
  }, [decodedGif, currentFrameIndex]);

  // Center and fit preview canvas when dimensions change
  useEffect(() => {
    if (!previewContainerRef.current || targetDimensions.w === 0 || targetDimensions.h === 0) return;

    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

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
      pixelColor: '#ffffff',
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

  const handleConfirm = useCallback(() => {
    if (decodedGif && gifFrames.length > 0) {
      trackEvent('gif_imported', {
        frame_count: gifFrames.length,
        width: targetDimensions.w,
        height: targetDimensions.h,
      });
      onConfirm(
        gifFrames[0].grid,
        targetDimensions.w,
        targetDimensions.h,
        {
          frames: gifFrames.map(f => ({ grid: f.grid, delayMs: f.delayMs })),
          name: imageFileName,
        }
      );
    } else if (convertedGrid && targetDimensions.w > 0) {
      trackEvent('image_imported', {
        width: targetDimensions.w,
        height: targetDimensions.h,
      });
      onConfirm(convertedGrid, targetDimensions.w, targetDimensions.h);
    }
  }, [decodedGif, gifFrames, targetDimensions, imageFileName, convertedGrid, onConfirm]);

  // Handle keyboard shortcuts (Escape to close, Enter to confirm, Space to toggle play)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === ' ' && decodedGif && gifFrames.length > 1) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleConfirm, onClose, decodedGif, gifFrames.length]);

  // Reset crop to full original dimensions
  const handleResetCrop = () => {
    if (originalDimensions.w > 0 && originalDimensions.h > 0) {
      setCropRect({ x: 0, y: 0, w: originalDimensions.w, h: originalDimensions.h });
    }
  };

  const isCropped =
    cropRect !== null &&
    originalDimensions.w > 0 &&
    originalDimensions.h > 0 &&
    (cropRect.x !== 0 ||
      cropRect.y !== 0 ||
      cropRect.w !== originalDimensions.w ||
      cropRect.h !== originalDimensions.h);

  // Calculate displayed size of reference image on screen (contained in 280x196 max box)
  const maxStageW = 280;
  const maxStageH = 196;
  let stageScale = 1;
  if (originalDimensions.w > 0 && originalDimensions.h > 0) {
    stageScale = Math.min(maxStageW / originalDimensions.w, maxStageH / originalDimensions.h);
  }
  const displayedW = Math.max(1, Math.round(originalDimensions.w * stageScale));
  const displayedH = Math.max(1, Math.round(originalDimensions.h * stageScale));
  const stagePixelScale = displayedW / (originalDimensions.w || 1);

  // Scaled crop rect for CSS overlay positioning
  const dLeft = Math.round((cropRect?.x || 0) * stagePixelScale);
  const dTop = Math.round((cropRect?.y || 0) * stagePixelScale);
  const dWidth = Math.max(2, Math.round((cropRect?.w || originalDimensions.w) * stagePixelScale));
  const dHeight = Math.max(2, Math.round((cropRect?.h || originalDimensions.h) * stagePixelScale));

  // Interactive mouse drag handler for crop box and handles
  const handleStartCropDrag = (
    e: React.MouseEvent,
    handleType: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropRect || stagePixelScale <= 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialCrop = { ...cropRect };
    const origW = originalDimensions.w;
    const origH = originalDimensions.h;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / stagePixelScale;
      const dy = (moveEvent.clientY - startY) / stagePixelScale;

      let { x, y, w, h } = initialCrop;

      if (handleType === 'move') {
        x = Math.max(0, Math.min(origW - w, Math.round(initialCrop.x + dx)));
        y = Math.max(0, Math.min(origH - h, Math.round(initialCrop.y + dy)));
      } else {
        if (handleType.includes('e')) {
          w = Math.max(2, Math.min(origW - x, Math.round(initialCrop.w + dx)));
        }
        if (handleType.includes('s')) {
          h = Math.max(2, Math.min(origH - y, Math.round(initialCrop.h + dy)));
        }
        if (handleType.includes('w')) {
          const newX = Math.max(0, Math.min(initialCrop.x + initialCrop.w - 2, Math.round(initialCrop.x + dx)));
          w = initialCrop.w + (initialCrop.x - newX);
          x = newX;
        }
        if (handleType.includes('n')) {
          const newY = Math.max(0, Math.min(initialCrop.y + initialCrop.h - 2, Math.round(initialCrop.y + dy)));
          h = initialCrop.h + (initialCrop.y - newY);
          y = newY;
        }
      }

      setCropRect({ x, y, w, h });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!isOpen) return null;

  return (
    <div className="image-import-backdrop" onClick={onClose}>
      <div className="image-import-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="image-import-header">
          <h3 className="image-import-title">
            <SlidersHorizontal size={15} />
            <span>Tune & Import {decodedGif ? 'GIF Animation' : 'Image'}</span>
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
            {/* Left: Original Reference with interactive crop */}
            <div className="image-import-panel">
              <div className="image-import-panel-header">
                <div className="flex items-center gap-2">
                  <span>Reference (Original)</span>
                  {decodedGif && (
                    <span className="image-import-gif-badge">
                      GIF • {decodedGif.frames.length} frames
                    </span>
                  )}
                  {isCropped && (
                    <button
                      type="button"
                      onClick={handleResetCrop}
                      className="image-import-reset-crop-btn"
                      title="Reset crop to full image"
                    >
                      <Crop size={11} />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
                <strong>
                  {cropRect ? `${cropRect.w}×${cropRect.h}` : `${originalDimensions.w}×${originalDimensions.h}`} px
                  {isCropped ? ' (Crop)' : ''}
                </strong>
              </div>
              <div className="image-import-original-view">
                {originalDimensions.w > 0 ? (
                  <div
                    className="image-import-crop-stage"
                    style={{
                      width: `${displayedW}px`,
                      height: `${displayedH}px`,
                    }}
                  >
                    {decodedGif ? (
                      <canvas
                        ref={refCanvasRef}
                        className="image-import-original-canvas"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : imageSrcRef.current ? (
                      <img
                        src={imageSrcRef.current}
                        alt="Original Reference"
                        className="image-import-original-img"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : null}

                    {/* Interactive Crop Overlay */}
                    {cropRect && (
                      <div className="image-import-crop-overlay">
                        {/* 4 Dimmed Masks */}
                        <div
                          className="image-import-crop-mask"
                          style={{ top: 0, left: 0, right: 0, height: `${dTop}px` }}
                        />
                        <div
                          className="image-import-crop-mask"
                          style={{
                            top: `${dTop + dHeight}px`,
                            left: 0,
                            right: 0,
                            bottom: 0,
                          }}
                        />
                        <div
                          className="image-import-crop-mask"
                          style={{
                            top: `${dTop}px`,
                            left: 0,
                            width: `${dLeft}px`,
                            height: `${dHeight}px`,
                          }}
                        />
                        <div
                          className="image-import-crop-mask"
                          style={{
                            top: `${dTop}px`,
                            left: `${dLeft + dWidth}px`,
                            right: 0,
                            height: `${dHeight}px`,
                          }}
                        />

                        {/* Active Crop Box */}
                        <div
                          className="image-import-crop-box"
                          style={{
                            top: `${dTop}px`,
                            left: `${dLeft}px`,
                            width: `${dWidth}px`,
                            height: `${dHeight}px`,
                          }}
                          onMouseDown={e => handleStartCropDrag(e, 'move')}
                          title="Drag to reposition crop area"
                        >
                          {/* 8 Resize Handles */}
                          <div
                            className="image-import-crop-handle handle-nw"
                            onMouseDown={e => handleStartCropDrag(e, 'nw')}
                          />
                          <div
                            className="image-import-crop-handle handle-n"
                            onMouseDown={e => handleStartCropDrag(e, 'n')}
                          />
                          <div
                            className="image-import-crop-handle handle-ne"
                            onMouseDown={e => handleStartCropDrag(e, 'ne')}
                          />
                          <div
                            className="image-import-crop-handle handle-e"
                            onMouseDown={e => handleStartCropDrag(e, 'e')}
                          />
                          <div
                            className="image-import-crop-handle handle-se"
                            onMouseDown={e => handleStartCropDrag(e, 'se')}
                          />
                          <div
                            className="image-import-crop-handle handle-s"
                            onMouseDown={e => handleStartCropDrag(e, 's')}
                          />
                          <div
                            className="image-import-crop-handle handle-sw"
                            onMouseDown={e => handleStartCropDrag(e, 'sw')}
                          />
                          <div
                            className="image-import-crop-handle handle-w"
                            onMouseDown={e => handleStartCropDrag(e, 'w')}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Loading original...</div>
                )}
              </div>
            </div>

            {/* Right: 1bpp Grid Preview */}
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

          {/* GIF Playback controls toolbar */}
          {decodedGif && decodedGif.frames.length > 1 && (
            <div className="image-import-playback-bar">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying(p => !p)}
                  className="image-import-play-btn"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    const nextIdx = (currentFrameIndex - 1 + gifFrames.length) % gifFrames.length;
                    setCurrentFrameIndex(nextIdx);
                    setConvertedGrid(gifFrames[nextIdx]?.grid || null);
                  }}
                  className="image-import-step-btn"
                  title="Previous Frame"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    const nextIdx = (currentFrameIndex + 1) % gifFrames.length;
                    setCurrentFrameIndex(nextIdx);
                    setConvertedGrid(gifFrames[nextIdx]?.grid || null);
                  }}
                  className="image-import-step-btn"
                  title="Next Frame"
                >
                  <ChevronRight size={13} />
                </button>
                <span className="image-import-frame-counter">
                  Frame <strong>{currentFrameIndex + 1}</strong> / {gifFrames.length}
                </span>
              </div>

              <div className="image-import-scrubber-container">
                <input
                  type="range"
                  min="0"
                  max={gifFrames.length - 1}
                  value={currentFrameIndex}
                  onChange={e => {
                    setIsPlaying(false);
                    const idx = Number(e.target.value);
                    setCurrentFrameIndex(idx);
                    setConvertedGrid(gifFrames[idx]?.grid || null);
                  }}
                  className="image-import-scrubber"
                />
              </div>

              <div className="image-import-speed-badge">
                <Film size={12} />
                <span>{gifFrames[currentFrameIndex]?.delayMs || 100}ms</span>
              </div>
            </div>
          )}

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
                  <option value="original">
                    Original ({baseW}×{baseH})
                  </option>
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
            {decodedGif && gifFrames.length > 1
              ? `Confirm to place all ${gifFrames.length} frames as a grouped symbol slice at an available canvas spot.`
              : 'Confirm to add as ghost drag on canvas without altering existing drawings.'}
          </span>
          <div className="image-import-actions">
            <button onClick={onClose} className="image-import-btn-cancel">
              Cancel (Esc)
            </button>
            <button
              onClick={handleConfirm}
              disabled={!convertedGrid && gifFrames.length === 0}
              className="image-import-btn-confirm"
            >
              <Sparkles size={13} />
              <span>
                {decodedGif && gifFrames.length > 1
                  ? `Place Animation on Canvas (${gifFrames.length} frames)`
                  : 'Place on Canvas (Enter)'}
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

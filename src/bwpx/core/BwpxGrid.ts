export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export class BwpxGrid {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Set<string>;

  constructor(width = 128, height = 34, initialData?: Uint8Array | number[] | Set<string>) {
    this.width = width;
    this.height = height;
    this.pixels = new Set<string>();

    if (initialData instanceof Set) {
      initialData.forEach(k => this.pixels.add(k));
    } else if (initialData && initialData.length > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (initialData[idx]) {
            this.pixels.add(`${x},${y}`);
          }
        }
      }
    }
  }

  /**
   * For backwards compatibility with code accessing .data
   */
  get data(): Uint8Array {
    const arr = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.pixels.has(`${x},${y}`)) {
          arr[y * this.width + x] = 1;
        }
      }
    }
    return arr;
  }

  getIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * On an infinite grid, all finite coordinates are valid.
   */
  inBounds(x: number, y: number): boolean {
    return Number.isInteger(x) && Number.isInteger(y);
  }

  get(x: number, y: number): number {
    return this.pixels.has(`${x},${y}`) ? 1 : 0;
  }

  set(x: number, y: number, val: number): void {
    const key = `${x},${y}`;
    if (val) {
      this.pixels.add(key);
    } else {
      this.pixels.delete(key);
    }
  }

  toggle(x: number, y: number): void {
    const key = `${x},${y}`;
    if (this.pixels.has(key)) {
      this.pixels.delete(key);
    } else {
      this.pixels.add(key);
    }
  }

  clear(_val = 0): void {
    this.pixels.clear();
  }

  countOn(): number {
    return this.pixels.size;
  }

  /**
   * Returns the bounding box of all active pixels.
   */
  getBounds(): GridBounds {
    if (this.pixels.size === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.pixels.forEach(key => {
      const comma = key.indexOf(',');
      const x = parseInt(key.slice(0, comma), 10);
      const y = parseInt(key.slice(comma + 1), 10);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * Returns all active pixel coordinates as [x, y] tuples.
   */
  getAllPixels(): [number, number][] {
    const list: [number, number][] = [];
    this.pixels.forEach(key => {
      const comma = key.indexOf(',');
      const x = parseInt(key.slice(0, comma), 10);
      const y = parseInt(key.slice(comma + 1), 10);
      list.push([x, y]);
    });
    return list;
  }

  /**
   * Extracts pixels inside a rectangle, returning relative coordinate tuples [relX, relY].
   */
  extractRect(rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }): [number, number][] {
    const extracted: [number, number][] = [];
    const w = rect.w ?? rect.width ?? 0;
    const h = rect.h ?? rect.height ?? 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (this.get(rect.x + dx, rect.y + dy)) {
          extracted.push([dx, dy]);
        }
      }
    }
    return extracted;
  }

  /**
   * Clears all pixels in a rectangle.
   */
  clearRect(rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number }): void {
    const w = rect.w ?? rect.width ?? 0;
    const h = rect.h ?? rect.height ?? 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(rect.x + dx, rect.y + dy, 0);
      }
    }
  }

  invert(bounds?: { minX: number; minY: number; width: number; height: number }): BwpxGrid {
    const next = this.clone();
    const b = bounds || {
      minX: 0,
      minY: 0,
      width: this.width,
      height: this.height,
    };

    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const curX = b.minX + x;
        const curY = b.minY + y;
        next.set(curX, curY, next.get(curX, curY) ? 0 : 1);
      }
    }
    return next;
  }

  flipH(bounds?: { minX: number; minY: number; width: number; height: number }): BwpxGrid {
    const next = this.clone();
    const b = bounds || this.getBounds();
    if (b.width <= 0 || b.height <= 0) return next;

    const extracted = this.extractRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });
    next.clearRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });

    extracted.forEach(([dx, dy]) => {
      const flippedDx = b.width - 1 - dx;
      next.set(b.minX + flippedDx, b.minY + dy, 1);
    });

    return next;
  }

  flipV(bounds?: { minX: number; minY: number; width: number; height: number }): BwpxGrid {
    const next = this.clone();
    const b = bounds || this.getBounds();
    if (b.width <= 0 || b.height <= 0) return next;

    const extracted = this.extractRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });
    next.clearRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });

    extracted.forEach(([dx, dy]) => {
      const flippedDy = b.height - 1 - dy;
      next.set(b.minX + dx, b.minY + flippedDy, 1);
    });

    return next;
  }

  rotate90(bounds?: { minX: number; minY: number; width: number; height: number }): BwpxGrid {
    const next = this.clone();
    const b = bounds || this.getBounds();
    if (b.width <= 0 || b.height <= 0) return next;

    const extracted = this.extractRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });
    next.clearRect({ x: b.minX, y: b.minY, w: b.width, h: b.height });

    extracted.forEach(([dx, dy]) => {
      const newDx = b.height - 1 - dy;
      const newDy = dx;
      next.set(b.minX + newDx, b.minY + newDy, 1);
    });

    return next;
  }

  clone(): BwpxGrid {
    return new BwpxGrid(this.width, this.height, this.pixels);
  }

  /**
   * Serializes to 1-bit-per-pixel byte array with row-major MSB first stride
   * (matching standard Zephyr / SSD1306 display drivers).
   */
  to1bppBytes(stride?: number, originX = 0, originY = 0, width?: number, height?: number): Uint8Array {
    const w = width ?? this.width;
    const h = height ?? this.height;
    const actualStride = stride ?? Math.ceil(w / 8);
    const bytes = new Uint8Array(h * actualStride);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.get(originX + x, originY + y)) {
          const byteIdx = y * actualStride + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          bytes[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    return bytes;
  }

  static from1bppBytes(bytes: Uint8Array, width: number, height: number, stride?: number, originX = 0, originY = 0): BwpxGrid {
    const actualStride = stride ?? Math.ceil(width / 8);
    const grid = new BwpxGrid(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIdx = y * actualStride + Math.floor(x / 8);
        if (byteIdx < bytes.length) {
          const bitIdx = 7 - (x % 8);
          const isSet = (bytes[byteIdx] >> bitIdx) & 1;
          if (isSet) {
            grid.set(originX + x, originY + y, 1);
          }
        }
      }
    }

    return grid;
  }

  toCArray(varName = "IMAGE_BITMAP"): string {
    const bounds = this.getBounds();
    const w = Math.max(this.width, bounds.width);
    const h = Math.max(this.height, bounds.height);
    const stride = Math.ceil(w / 8);
    const bytes = this.to1bppBytes(stride, 0, 0, w, h);
    const lines: string[] = [];

    lines.push(`/* ${w}x${h} 1bpp monochrome bitmap (stride ${stride}) */`);
    lines.push(`static const uint8_t ${varName}[${h * stride}] = {`);

    for (let y = 0; y < h; y++) {
      const hexParts: string[] = [];
      let asciiComment = "";

      for (let s = 0; s < stride; s++) {
        const b = bytes[y * stride + s];
        hexParts.push("0x" + b.toString(16).toUpperCase().padStart(2, "0"));
      }

      for (let x = 0; x < w; x++) {
        asciiComment += this.get(x, y) ? "#" : " ";
      }

      lines.push(`    ${hexParts.join(", ")}, // Row ${y.toString().padStart(2, " ")}: |${asciiComment}|`);
    }

    lines.push("};");
    return lines.join("\n");
  }

  getSubRect(x: number, y: number, w: number, h: number): BwpxGrid {
    const sub = new BwpxGrid(w, h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        sub.set(c, r, this.get(x + c, y + r));
      }
    }
    return sub;
  }

  blit(src: BwpxGrid, dstX: number, dstY: number, transparentZero = false): void {
    if (!transparentZero) {
      this.clearRect({ x: dstX, y: dstY, width: src.width, height: src.height });
    }
    src.pixels.forEach(key => {
      const comma = key.indexOf(',');
      const x = parseInt(key.slice(0, comma), 10);
      const y = parseInt(key.slice(comma + 1), 10);
      this.set(dstX + x, dstY + y, 1);
    });
  }
}

import YAML from 'yaml';

export interface BuildYamlIncludeEntry {
  board: string;
  shield?: string;
  snippet?: string;
  'cmake-args'?: string;
  'artifact-name'?: string;
  [key: string]: any;
}

export interface AddScyanShieldOptions {
  rightIsCentral?: boolean;
  displayAssignments?: Record<string, string | number | null | undefined | boolean>;
  targetFilter?: (entry: BuildYamlIncludeEntry) => boolean;
}

export const SCYAN_SHIELD_TOKEN_REGEX = /^scyan_screen(?:_[a-zA-Z0-9_]+)?$/i;

/**
 * Resolves a matching display assignment for a shield token.
 * Checks exact match, normalized hyphens/underscores, suffix match, and role keywords.
 */
function findAssignmentForToken(
  token: string,
  displayAssignments: Record<string, string | number | null | undefined | boolean>
): string | number | null | undefined | boolean {
  if (token in displayAssignments) {
    return displayAssignments[token];
  }

  const lowerToken = token.toLowerCase();
  const normToken = lowerToken.replace(/[-_]/g, '');

  // Case-insensitive and hyphen/underscore normalized match
  for (const [key, val] of Object.entries(displayAssignments)) {
    const lowerKey = key.toLowerCase();
    const normKey = lowerKey.replace(/[-_]/g, '');
    if (normKey === normToken) {
      return val;
    }
  }

  // Suffix/prefix match (e.g. key is 'left' or 'dongle' and token is 'corne_left' or 'corne_dongle')
  for (const [key, val] of Object.entries(displayAssignments)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerToken.endsWith(`_${lowerKey}`) ||
      lowerToken.endsWith(`-${lowerKey}`) ||
      lowerKey.endsWith(`_${lowerToken}`) ||
      lowerKey.endsWith(`-${lowerToken}`)
    ) {
      return val;
    }
  }

  // Role polarity match
  const isLeftOrCentral = /(?:^|[_\-])(?:left|central)(?:$|[_\-])/i.test(lowerToken) || lowerToken.endsWith('left');
  const isRightOrPeripheral = /(?:^|[_\-])(?:right|peripheral)(?:$|[_\-])/i.test(lowerToken) || lowerToken.endsWith('right');

  for (const [key, val] of Object.entries(displayAssignments)) {
    const lowerKey = key.toLowerCase();
    if (isLeftOrCentral && (lowerKey === 'left' || lowerKey === 'central')) {
      return val;
    }
    if (isRightOrPeripheral && (lowerKey === 'right' || lowerKey === 'peripheral')) {
      return val;
    }
  }

  return undefined;
}

/**
 * Detects whether build.yaml uses a Cartesian matrix (top-level `board:` and/or `shield:` arrays).
 */
export function isCartesianMatrix(content: string): boolean {
  if (!content || !content.trim()) return false;
  try {
    const doc = YAML.parseDocument(content);
    if (!doc || !doc.contents || !YAML.isMap(doc.contents)) {
      return false;
    }
    const hasBoard = doc.has('board');
    const hasShield = doc.has('shield');
    return hasBoard || hasShield;
  } catch {
    return false;
  }
}

/**
 * Losslessly converts a Cartesian matrix (`board: [...]`, `shield: [...]`) build.yaml
 * into explicit `include:` format while preserving comments, custom properties, and formatting.
 */
export function convertCartesianToInclude(content: string): string {
  if (!isCartesianMatrix(content)) {
    return content;
  }

  const doc = YAML.parseDocument(content);
  if (!doc || !doc.contents || !YAML.isMap(doc.contents)) {
    return content;
  }

  // Extract raw boards
  const rawBoard = doc.get('board') as any;
  let boards: string[] = [];
  if (Array.isArray(rawBoard?.items)) {
    boards = rawBoard.items.map((it: any) => String(it?.value ?? it));
  } else if (Array.isArray(rawBoard)) {
    boards = rawBoard.map(String);
  } else if (rawBoard !== undefined && rawBoard !== null) {
    boards = [String((rawBoard as any)?.value ?? rawBoard)];
  }

  // Extract raw shields
  const rawShield = doc.get('shield') as any;
  let shields: string[] = [];
  if (Array.isArray(rawShield?.items)) {
    shields = rawShield.items.map((it: any) => String(it?.value ?? it));
  } else if (Array.isArray(rawShield)) {
    shields = rawShield.map(String);
  } else if (rawShield !== undefined && rawShield !== null) {
    shields = [String((rawShield as any)?.value ?? rawShield)];
  }

  // Extract existing includes if any
  const existingIncludeNode = doc.get('include') as any;
  const existingIncludes: BuildYamlIncludeEntry[] = [];
  if (existingIncludeNode && YAML.isSeq(existingIncludeNode)) {
    for (const it of existingIncludeNode.items) {
      if (it && typeof (it as any).toJSON === 'function') {
        existingIncludes.push((it as any).toJSON() as BuildYamlIncludeEntry);
      } else if (it && typeof it === 'object') {
        existingIncludes.push(it as BuildYamlIncludeEntry);
      }
    }
  }

  // Build Cartesian product
  const expandedIncludes: BuildYamlIncludeEntry[] = [];
  const matchedExistingIndices = new Set<number>();

  const targetBoards = boards.length > 0 ? boards : [undefined];
  const targetShields = shields.length > 0 ? shields : [undefined];

  for (const b of targetBoards) {
    for (const s of targetShields) {
      // Find matching existing include entry to preserve snippet, cmake-args, etc.
      const matchIdx = existingIncludes.findIndex((inc, idx) => {
        if (matchedExistingIndices.has(idx)) return false;
        const boardMatches = !b || inc.board === b;
        const shieldMatches = !s || inc.shield === s;
        return boardMatches && shieldMatches;
      });

      if (matchIdx !== -1) {
        matchedExistingIndices.add(matchIdx);
        expandedIncludes.push({ ...existingIncludes[matchIdx] });
      } else if (b) {
        const entry: BuildYamlIncludeEntry = {
          board: b,
          ...(s ? { shield: s } : {}),
        };
        expandedIncludes.push(entry);
      }
    }
  }

  // Append any remaining include entries not covered by the Cartesian matrix
  existingIncludes.forEach((inc, idx) => {
    if (!matchedExistingIndices.has(idx)) {
      expandedIncludes.push(inc);
    }
  });

  // Mutate YAML doc cleanly while preserving comments on the board key
  const boardPair = (doc.contents as any).items.find(
    (it: any) => it?.key && (it.key.value === 'board' || it.key === 'board')
  );

  doc.delete('shield');

  if (boardPair) {
    if (typeof boardPair.key === 'object' && 'value' in boardPair.key) {
      boardPair.key.value = 'include';
    } else {
      boardPair.key = 'include';
    }
    boardPair.value = doc.createNode(expandedIncludes);

    // If there was an existing 'include' pair after boardPair, remove it
    const otherIncludeIdx = (doc.contents as any).items.findIndex(
      (it: any) => it !== boardPair && it?.key && (it.key.value === 'include' || it.key === 'include')
    );
    if (otherIncludeIdx !== -1) {
      (doc.contents as any).items.splice(otherIncludeIdx, 1);
    }
  } else {
    doc.delete('board');
    doc.set('include', doc.createNode(expandedIncludes));
  }

  return doc.toString();
}

/**
 * Determines the Scyan shield token ('scyan_screen_1', 'scyan_screen_2', 'scyan_screen_<slot>', or 'scyan_screen')
 * based on keyboard shield name, left/right polarity, and display assignments.
 * Returns undefined if target should not receive a screen shield (e.g. utility shields like settings_reset,
 * or targets explicitly configured with no display).
 */
export function determineScyanShieldToken(
  shieldStr?: string,
  options?: AddScyanShieldOptions
): string | undefined {
  if (!shieldStr || !shieldStr.trim()) {
    return 'scyan_screen';
  }

  const tokens = shieldStr.trim().split(/\s+/).filter(t => !SCYAN_SHIELD_TOKEN_REGEX.test(t));
  if (tokens.length === 0) {
    return 'scyan_screen';
  }

  // Non-display utility shields (e.g. settings_reset) must never receive a screen shield
  if (tokens.some(t => t.toLowerCase() === 'settings_reset')) {
    return undefined;
  }

  // 1. Check custom display assignments if provided
  if (options?.displayAssignments) {
    for (const token of tokens) {
      const assigned = findAssignmentForToken(token, options.displayAssignments);
      if (assigned === null || assigned === false || assigned === 'none') {
        return undefined;
      }
      if (assigned !== undefined) {
        const assignedStr = String(assigned).trim().toLowerCase().replace(/^display-?/, '');
        if (assignedStr === 'left' || assignedStr === 'central') {
          return options.rightIsCentral ? 'scyan_screen_2' : 'scyan_screen_1';
        }
        if (assignedStr === 'right' || assignedStr === 'peripheral') {
          return options.rightIsCentral ? 'scyan_screen_1' : 'scyan_screen_2';
        }
        const match = assignedStr.match(/\d+/);
        const slotNum = match ? match[0] : assignedStr;
        return slotNum ? `scyan_screen_${slotNum}` : 'scyan_screen';
      }
    }
  }

  // 2. Polarity heuristic based on shield tokens
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (/(?:^|[_\-])(?:right|peripheral)(?:$|[_\-])/.test(lower) || lower.endsWith('right')) {
      return options?.rightIsCentral ? 'scyan_screen_1' : 'scyan_screen_2';
    }
    if (/(?:^|[_\-])(?:left|central)(?:$|[_\-])/.test(lower) || lower.endsWith('left')) {
      return options?.rightIsCentral ? 'scyan_screen_2' : 'scyan_screen_1';
    }
  }

  return 'scyan_screen';
}

/**
 * Appends or updates a Scyan shield token in a space-separated shield string.
 */
export function updateShieldTokens(shieldStr: string | undefined, tokenToAdd: string): string {
  const tokens = (shieldStr || '').trim().split(/\s+/).filter(Boolean);
  const nonScyanTokens = tokens.filter(t => !SCYAN_SHIELD_TOKEN_REGEX.test(t));
  return [...nonScyanTokens, tokenToAdd].join(' ');
}

/**
 * Strips any Scyan shield tokens from a space-separated shield string.
 * Returns undefined if no tokens remain.
 */
export function removeShieldTokens(shieldStr: string | undefined): string | undefined {
  const tokens = (shieldStr || '').trim().split(/\s+/).filter(Boolean);
  const remaining = tokens.filter(t => !SCYAN_SHIELD_TOKEN_REGEX.test(t));
  if (remaining.length === 0) {
    return undefined;
  }
  return remaining.join(' ');
}

/**
 * Ensures build.yaml is in `include:` format and injects the appropriate Scyan shield
 * token (`scyan_screen_left`, `scyan_screen_right`, or `scyan_screen`) to target shields.
 */
export function addScyanShieldToBuildYaml(
  content: string,
  options?: AddScyanShieldOptions
): string {
  let yamlText = content;
  if (isCartesianMatrix(yamlText)) {
    yamlText = convertCartesianToInclude(yamlText);
  }

  const doc = YAML.parseDocument(yamlText);
  if (!doc || !doc.contents || !YAML.isMap(doc.contents)) {
    return yamlText;
  }

  const includeNode = doc.get('include') as any;
  if (includeNode && YAML.isSeq(includeNode)) {
    for (const item of includeNode.items) {
      if (!item || !YAML.isMap(item)) continue;

      const jsItem: BuildYamlIncludeEntry = typeof item.toJSON === 'function' ? item.toJSON() : (item as any);
      if (options?.targetFilter && !options.targetFilter(jsItem)) {
        continue;
      }

      const currentShield = item.get('shield');
      const shieldStr = typeof currentShield === 'string' ? currentShield : undefined;

      // Do not inject shield onto standalone board targets that have no shield property
      if (!shieldStr && !options?.targetFilter) {
        continue;
      }

      const scyanToken = determineScyanShieldToken(shieldStr, options);
      if (scyanToken) {
        const updatedShield = updateShieldTokens(shieldStr, scyanToken);
        item.set('shield', updatedShield);
      } else if (shieldStr) {
        // Clean Scyan shield token if this target should not have one (e.g. settings_reset)
        const cleanedShield = removeShieldTokens(shieldStr);
        if (cleanedShield === undefined) {
          item.delete('shield');
        } else {
          item.set('shield', cleanedShield);
        }
      }
    }
  }

  return doc.toString();
}

/**
 * Removes all Scyan shield tokens (`scyan_screen`, `scyan_screen_left`, `scyan_screen_right`)
 * from `build.yaml`.
 */
export function removeScyanShieldFromBuildYaml(content: string): string {
  if (!content || !content.trim()) return content;

  const doc = YAML.parseDocument(content);
  if (!doc || !doc.contents || !YAML.isMap(doc.contents)) {
    return content;
  }

  // 1. Clean `include:` sequence
  const includeNode = doc.get('include') as any;
  if (includeNode && YAML.isSeq(includeNode)) {
    for (const item of includeNode.items) {
      if (!item || !YAML.isMap(item)) continue;
      const currentShield = item.get('shield');
      if (typeof currentShield === 'string') {
        const remaining = removeShieldTokens(currentShield);
        if (remaining === undefined) {
          item.delete('shield');
        } else {
          item.set('shield', remaining);
        }
      }
    }
  }

  // 2. Clean top-level `shield:` sequence if Cartesian was still present
  const shieldNode = doc.get('shield') as any;
  if (shieldNode && YAML.isSeq(shieldNode)) {
    const newItems: any[] = [];
    for (const it of shieldNode.items) {
      const val = String((it as any)?.value ?? it).trim();
      const remaining = removeShieldTokens(val);
      if (remaining !== undefined) {
        if (it && typeof it === 'object' && 'value' in it) {
          (it as any).value = remaining;
          newItems.push(it);
        } else {
          newItems.push(remaining);
        }
      }
    }
    doc.set('shield', newItems);
  }

  return doc.toString();
}

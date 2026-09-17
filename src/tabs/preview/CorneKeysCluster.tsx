import React from 'react';
import type { ParsedKeymapLayout } from '../../services/keymapService';

export interface CorneKeysClusterProps {
  isLeft: boolean;
  keymapLayout: ParsedKeymapLayout;
  matrix: string[][];
  thumbs: string[];
  pressedKeys: Set<string>;
  onKeyPress: (coordId: string) => void;
  getColStagger: (col: number, totalCols: number, isRight: boolean) => number;
}

export const CorneKeysCluster: React.FC<CorneKeysClusterProps> = ({
  isLeft,
  keymapLayout,
  matrix,
  thumbs,
  pressedKeys,
  onKeyPress,
  getColStagger,
}) => {
  const sidePrefix = isLeft ? 'L' : 'R';
  const thumbPrefix = isLeft ? 'LT' : 'RT';

  return (
    <div className="corne-keys-cluster">
      <div className="corne-matrix">
        {Array.from({ length: keymapLayout.columns }, (_, colIdx) => (
          <div
            key={colIdx}
            className="corne-col"
            style={{ transform: `translateY(${getColStagger(colIdx, keymapLayout.columns, !isLeft)}px)` }}
          >
            {Array.from({ length: keymapLayout.rows }, (_, rowIdx) => {
              const keyLabel = matrix[rowIdx]?.[colIdx] || '';
              const coordId = `${sidePrefix}_${rowIdx}_${colIdx}`;
              const isPressed = pressedKeys.has(coordId);
              const isEmpty = !keyLabel;
              return (
                <div
                  key={rowIdx}
                  className={`corne-keycap ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
                  onClick={() => onKeyPress(coordId)}
                  title={keyLabel ? `${isLeft ? 'Left' : 'Right'} [${rowIdx},${colIdx}]: ${keyLabel}` : `${isLeft ? 'Left' : 'Right'} [${rowIdx},${colIdx}]`}
                >
                  {keyLabel ? <span className="keycap-legend">{keyLabel}</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className={`corne-thumbs ${isLeft ? 'left-thumbs' : 'right-thumbs'}`}>
        {thumbs.map((t, idx) => {
          const coordId = `${thumbPrefix}_${idx}`;
          const isPressed = pressedKeys.has(coordId);
          const isEmpty = !t;
          return (
            <div
              key={idx}
              className={`corne-thumb-key thumb-${idx} ${isEmpty ? 'empty' : ''} ${isPressed ? 'pressed' : ''}`}
              onClick={() => onKeyPress(coordId)}
              title={t ? `${isLeft ? 'Left' : 'Right'} Thumb [${idx}]: ${t}` : `${isLeft ? 'Left' : 'Right'} Thumb [${idx}]`}
            >
              {t ? <span className="thumb-legend">{t}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

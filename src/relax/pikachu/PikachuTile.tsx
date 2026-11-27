import React from 'react';
import { PikachuSpriteDef } from './GameAssets';

interface PikachuTileProps {
  sprite: PikachuSpriteDef | undefined;
  isSelected: boolean;
  isHinted: boolean;
  isMatchedFlash: boolean;
  isMismatchShake: boolean;
  basicMode: boolean;
  disabled: boolean;
  onSelect: () => void;
}

export const PikachuTile: React.FC<PikachuTileProps> = React.memo(
  ({
    sprite,
    isSelected,
    isHinted,
    isMatchedFlash,
    isMismatchShake,
    basicMode,
    disabled,
    onSelect,
  }) => {
    if (!sprite) {
      return <div className="aspect-square w-full pointer-events-none select-none" aria-hidden="true" />;
    }

    const baseBg = isSelected
      ? 'bg-[#FEF3C7] border-[#D97706] shadow-[0_1px_1px_rgba(35,20,10,0.28)] ring-2 ring-[#FACC15]'
      : isHinted
      ? 'bg-[#E0F2FE] border-[#0284C7] shadow-[0_1px_1px_rgba(35,20,10,0.25)] ring-2 ring-[#38BDF8]'
      : 'bg-[#FBF3E8] border-[#BA8F68] shadow-[0_1px_1px_rgba(35,20,10,0.22)] hover:bg-[#FFF9F1]';

    const stateTransforms = isMatchedFlash
      ? 'scale-90 opacity-0'
      : isMismatchShake
      ? 'translate-x-0.5 border-red-600 ring-2 ring-red-400'
      : isSelected
      ? 'scale-[1.03] z-20'
      : isHinted && !basicMode
      ? 'scale-[1.03] z-20 animate-pulse'
      : '';

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-label={sprite.name}
        aria-pressed={isSelected}
        title={sprite.name}
        className={`relative aspect-square w-full rounded-[4px] border transition-all duration-150 select-none flex items-center justify-center p-[2%] sm:p-[2.5%] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default ${baseBg} ${stateTransforms}`}
      >
        <img
          src={sprite.dataUrl}
          alt={sprite.name}
          draggable={false}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      </button>
    );
  }
);

PikachuTile.displayName = 'PikachuTile';

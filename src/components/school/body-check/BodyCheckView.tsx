import { BodyCheckMarker } from '@/lib/schools';

interface BodyCheckViewProps {
  front: BodyCheckMarker[];
  back: BodyCheckMarker[];
}

// Front + back body map with marker overlay and numbered notes list.
// Marker % positions are relative to the <img> box: keep the width on the <img>, not the wrapper.
export default function BodyCheckView({ front, back }: BodyCheckViewProps) {
  const sides = { front, back };
  return (
    <div className="grid grid-cols-2 gap-6">
      {(['front', 'back'] as const).map((side) => {
        const markers = sides[side];
        const imgSrc = side === 'front'
          ? '/assets/images/body-check/baby-front.png'
          : '/assets/images/body-check/baby-back.png';
        return (
          <div key={side} className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {side}
            </p>
            {/* Image with overlaid marker dots — wrapper is exactly image size */}
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={side}
                className="block w-40 object-contain"
              />
              {/* Marker dots at normalized (x,y) % positions */}
              {markers.map((m, i) => (
                <div
                  key={i}
                  title={m.note || undefined}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#1A1A6D] dark:border-[#20B2AA] flex items-center justify-center z-10 cursor-default"
                  style={{ left: `${m.x_marker * 100}%`, top: `${m.y_marker * 100}%` }}
                >
                  <div className="w-2 h-2 rounded-full bg-[#1A1A6D] dark:bg-[#20B2AA]" />
                </div>
              ))}
            </div>
            {/* Notes list */}
            {markers.length > 0 ? (
              <div className="w-full space-y-1">
                {markers.map((m, i) => (
                  <div key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-800 dark:text-gray-200">
                    <span className="font-semibold text-[#1A1A6D] dark:text-[#20B2AA]">#{i + 1}</span>
                    {m.note ? ` — ${m.note}` : ' — no note'}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center">No markers</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

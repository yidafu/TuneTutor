import type { TranslationSet } from '../../locales';

interface ScoreInfoProps {
  title: string;
  composer?: string;
  timeSignature: string;
  tempo: number;
  t: TranslationSet;
}

export function ScoreInfo({ title, composer, timeSignature, tempo, t }: ScoreInfoProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {composer && <p className="text-sm text-gray-500">{t.composer} {composer}</p>}
      </div>
      <div className="text-sm text-gray-500">
        <span aria-label="Time signature">{timeSignature}</span>
        <span aria-hidden="true" className="mx-2">•</span>
        <span aria-label="Tempo">{tempo} {t.bpm}</span>
      </div>
    </div>
  );
}

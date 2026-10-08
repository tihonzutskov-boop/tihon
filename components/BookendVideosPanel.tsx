import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { LibraryExercise } from '../types';
import { VIDEO_USES, videoUseOf, withVideoUse, videoStatus, videoCoverage } from '../utils/bookendVideos';
import type { VideoUse } from '../utils/bookendVideos';

interface BookendVideosPanelProps {
  exercises: LibraryExercise[];
  onSave: (updated: LibraryExercise[]) => Promise<void>;
}

interface Row {
  ex: LibraryExercise;
  use: VideoUse;
  length: string;
  /** Asked to switch on a video that is already set up for an end but is off. */
  fix: boolean;
}

const buildRow = (ex: LibraryExercise): Row => ({ ex, use: videoUseOf(ex), length: ex.videoDurationLabel || '', fix: false });

// The row as it would be saved, which is also what the status beside it is read from.
const applied = (r: Row): LibraryExercise => ({ ...withVideoUse(r.ex, r.use), videoDurationLabel: r.length.trim() });

const changed = (r: Row) => r.fix || r.use !== videoUseOf(r.ex) || r.length.trim() !== (r.ex.videoDurationLabel || '').trim();

/**
 * Which follow-along videos the plans use for the warm-up and the cool-down.
 * One choice per video; the switches the generator needs behind it are set for
 * you, and a video that is not being picked says why.
 */
const BookendVideosPanel: React.FC<BookendVideosPanelProps> = ({ exercises, onSave }) => {
  const videos = useMemo(() => exercises.filter(e => e.exerciseType === 'video'), [exercises]);
  const [rows, setRows] = useState<Row[]>(() => videos.map(buildRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const update = (id: string, patch: Partial<Row>) => {
    setSavedAt(null);
    setRows(prev => prev.map(r => (r.ex.id === id ? { ...r, ...patch } : r)));
  };

  // What plans use right now: the saved videos, not the changes waiting to be saved.
  const coverage = videoCoverage(rows.map(r => r.ex));
  const dirty = rows.some(changed);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const toSave = rows.filter(changed).map(applied);
      if (toSave.length === 0) return;
      await onSave(toSave);
      setRows(prev => prev.map(r => (changed(r) ? buildRow(applied(r)) : r)));
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const end = (label: string, c: { videos: number; minutes: number }) => (
    <div className="flex-1 min-w-[150px]">
      <div className="text-[22px] font-extrabold leading-none">
        {c.videos}<span className="text-xs font-bold text-slate-500"> {c.videos === 1 ? 'video' : 'videos'}</span>
      </div>
      <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mt-1">
        {label}{c.videos > 0 ? ` · ${c.minutes} min` : ''}
      </div>
      {c.videos === 0 && <div className="text-[10.5px] text-amber-400 mt-1">Sessions show this written out instead</div>}
    </div>
  );

  return (
    <div className="pb-8">
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-3.5">
        <div className="flex items-start gap-6 flex-wrap">
          {end('Warm-up', coverage.warmup)}
          {end('Cool-down', coverage.cooldown)}
          <p className="text-[11px] text-slate-400 leading-relaxed flex-1 min-w-[220px]">
            Set what each video is for and plans use it in place of the written stretching and activation. It
            shows up in plans clients already have the next time they open a session, with no need to rebuild them.
            A session uses about 5 minutes of warm-up videos and 5 to 9 of cool-down, picked for the muscles that day trains.
          </p>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="p-10 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500 leading-relaxed">
          No follow-along videos in the library yet. Add an exercise, choose the video type and paste the
          YouTube link, then set it up here.
        </div>
      ) : (
        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950">
                {['Video', 'Used for', 'Length', 'Status'].map(h => (
                  <th key={h} className="text-left text-[9px] font-extrabold text-slate-500 uppercase tracking-wider px-3.5 py-2.5 border-b border-slate-800 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                // What plans do with it now until something is changed, then what saving would make of it.
                const pending = changed(r);
                const s = videoStatus(pending ? applied(r) : r.ex);
                return (
                  <tr key={r.ex.id} className={`border-b border-slate-800/60 last:border-none ${s.ready ? 'bg-lime-500/[0.035]' : ''}`}>
                    <td className="px-3.5 py-2.5 align-middle">
                      <div className="text-[12.5px] font-bold text-white">{r.ex.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{r.ex.targetMuscle}</div>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle">
                      <select
                        value={r.use}
                        onChange={e => update(r.ex.id, { use: e.target.value as VideoUse })}
                        aria-label={`What ${r.ex.name} is used for`}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-white focus:outline-none focus:border-lime-500"
                      >
                        {VIDEO_USES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle">
                      <input
                        value={r.length}
                        onChange={e => update(r.ex.id, { length: e.target.value })}
                        placeholder="5 min"
                        aria-label={`How long ${r.ex.name} runs`}
                        className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11.5px] text-white placeholder:text-slate-600 focus:outline-none focus:border-lime-500"
                      />
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-[11px]">
                      {s.ready && <span className="font-bold text-lime-400">{pending ? 'Will be used' : 'Used'} in plans · {s.minutes} min</span>}
                      {s.use === 'none' && <span className="text-slate-500">Not in warm-ups or cool-downs</span>}
                      {s.problems.map(p => <div key={p} className="font-bold text-amber-400">{p}</div>)}
                      {s.problems.length > 0 && !pending && (
                        <button
                          onClick={() => update(r.ex.id, { fix: true })}
                          className="mt-1 px-2.5 py-1 rounded-md bg-lime-500/10 border border-lime-500/30 text-lime-400 text-[10.5px] font-extrabold hover:bg-lime-500/20 transition-colors"
                        >
                          Switch on
                        </button>
                      )}
                      {s.use !== 'none' && s.notes.map(n => <div key={n} className="text-slate-500 mt-0.5">{n}</div>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-lg bg-lime-500 hover:bg-lime-400 disabled:opacity-40 disabled:hover:bg-lime-500 text-slate-950 text-[11.5px] font-extrabold transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
        {savedAt && !dirty && <span className="text-[11px] font-bold text-lime-400">Saved</span>}
        {error && <span className="text-[11px] font-bold text-red-400">{error}</span>}
      </div>
    </div>
  );
};

export default BookendVideosPanel;

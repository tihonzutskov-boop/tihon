import React, { useEffect, useRef, useState } from 'react';
import { HardDrive, Loader2, CloudUpload, AlertTriangle, Check, RefreshCw, Minimize2 } from 'lucide-react';
import { api } from '../services/api';
import { heaviestVideos, formatVideoSize } from '../utils/videoSize';
import { shrinkVideo, canShrinkVideo } from '../services/videoShrink';

/**
 * Moving tutorial videos out of the database.
 *
 * Videos were stored in Postgres. The disk filled, and a Postgres that cannot
 * write its WAL refuses connections outright — so the whole app went down, not
 * just video uploads. This panel moves them to object storage and then frees
 * what they were holding.
 *
 * Copy and delete are two separate buttons on purpose. Anything else has a
 * window where one failure destroys the only copy of a video.
 */

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

interface StorageState {
  storingNewVideosIn: string;
  totalVideos: number;
  migrated: number;
  pending: number;
  bytesStillInDatabase: number;
  videos: { id: string; name: string; bytes: number; migrated: boolean; stillInDatabase: boolean }[];
}

// Where one heavy video is in being shrunk. The shrunk copy is shown to the admin
// before anything is replaced: replacing deletes the original.
type ShrinkStep =
  | { stage: 'downloading'; received: number; total: number | null }
  | { stage: 'shrinking'; fraction: number }
  | { stage: 'ready'; file: File; previewUrl: string; originalBytes: number; width: number; height: number }
  | { stage: 'uploading' }
  | { stage: 'done'; name: string; from: number; to: number }
  | { stage: 'failed'; reason: string };

const VideoStoragePanel: React.FC = () => {
  const [state, setState] = useState<StorageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'migrating' | 'purging' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [shrinks, setShrinks] = useState<Record<string, ShrinkStep>>({});
  const previewUrls = useRef<Set<string>>(new Set());

  useEffect(() => () => { previewUrls.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  const setShrink = (id: string, step: ShrinkStep | null) =>
    setShrinks(prev => {
      const next = { ...prev };
      const old = prev[id];
      if (old?.stage === 'ready' && (!step || step.stage !== 'ready')) {
        URL.revokeObjectURL(old.previewUrl);
        previewUrls.current.delete(old.previewUrl);
      }
      if (step) next[id] = step; else delete next[id];
      return next;
    });

  // One at a time: each holds the whole video in memory, twice, while it works.
  const shrinkBusy = (Object.values(shrinks) as ShrinkStep[]).some(s => s.stage === 'downloading' || s.stage === 'shrinking' || s.stage === 'uploading');

  const startShrink = async (v: { id: string; name: string }) => {
    setShrink(v.id, { stage: 'downloading', received: 0, total: null });
    const download = await api.fetchTutorialVideo(v.id, (received, total) =>
      setShrink(v.id, { stage: 'downloading', received, total }));
    if (!download.ok || !download.video) {
      setShrink(v.id, { stage: 'failed', reason: `Could not download it: ${download.error || 'unknown error'}` });
      return;
    }
    setShrink(v.id, { stage: 'shrinking', fraction: 0 });
    let shown = 0;
    const outcome = await shrinkVideo(download.video, v.name, fraction => {
      // Every frame reports progress; a re-render per whole percent is plenty.
      if (fraction - shown >= 0.01 || fraction === 1) { shown = fraction; setShrink(v.id, { stage: 'shrinking', fraction }); }
    });
    if (outcome.ok === false) { setShrink(v.id, { stage: 'failed', reason: outcome.reason }); return; }
    const previewUrl = URL.createObjectURL(outcome.file);
    previewUrls.current.add(previewUrl);
    setShrink(v.id, {
      stage: 'ready', file: outcome.file, previewUrl, originalBytes: outcome.originalBytes,
      width: outcome.width, height: outcome.height,
    });
  };

  const useShrunk = async (v: { id: string; name: string }, step: Extract<ShrinkStep, { stage: 'ready' }>) => {
    setShrink(v.id, { stage: 'uploading' });
    const upload = await api.uploadTutorialVideo(v.id, step.file);
    if (!upload.ok) {
      setShrink(v.id, { stage: 'failed', reason: `Could not upload the smaller copy, so the original is still in place: ${upload.error || 'unknown error'}` });
      return;
    }
    setShrink(v.id, { stage: 'done', name: v.name, from: step.originalBytes, to: step.file.size });
    await load();
  };

  const load = async () => {
    setLoading(true);
    const data = await api.fetchVideoStorage();
    setState(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const migrateAll = async () => {
    setWorking('migrating');
    setError(null);
    let guard = 0;
    // Loops batches rather than asking for everything at once: a single
    // request moving forty videos would outlast any sane HTTP timeout.
    while (guard++ < 200) {
      const result = await api.migrateVideoBatch(3);
      if (!result.ok) { setError(result.error || 'Migration failed'); break; }
      if (result.failed?.length) {
        setError(`${result.failed.length} could not be moved: ${result.failed.map((f: any) => f.name).join(', ')}`);
      }
      setProgress(`${result.remaining ?? 0} left to move…`);
      if ((result.remaining ?? 0) === 0) break;
    }
    setProgress(null);
    setWorking(null);
    await load();
  };

  const purge = async () => {
    setWorking('purging');
    setError(null);
    const result = await api.purgeDatabaseVideos();
    if (!result.ok) setError(result.error || 'Purge failed');
    else if (result.reclaimed === false) {
      setError(`Rows deleted, but the disk was not reclaimed: ${result.vacuumError}. This usually means there is not enough free space to rewrite the table.`);
    }
    setWorking(null);
    setConfirmPurge(false);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm p-5">
        <Loader2 className="w-4 h-4 animate-spin" /> Reading video storage…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="m-5 p-4 rounded-2xl bg-red-950/20 border border-red-800/40 text-xs text-red-400">
        Could not read video storage state.
      </div>
    );
  }

  const onObjectStorage = state.storingNewVideosIn === 'object storage';
  const heavy = heaviestVideos<StorageState['videos'][number]>(state.videos || []);

  return (
    <div className="m-5 bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-slate-500" />
          <div>
            <h3 className="text-sm font-bold text-white">Tutorial video storage</h3>
            <p className="text-[11px] text-slate-500">
              New uploads go to{' '}
              <span className={onObjectStorage ? 'text-lime-400 font-semibold' : 'text-orange-400 font-semibold'}>
                {state.storingNewVideosIn}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white text-[11px] font-bold transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['In object storage', String(state.migrated), state.migrated > 0 ? 'text-lime-400' : 'text-slate-400'],
          ['Still in the database', String(state.pending), state.pending > 0 ? 'text-orange-400' : 'text-lime-400'],
          ['Database space used', mb(state.bytesStillInDatabase), state.bytesStillInDatabase > 0 ? 'text-orange-400' : 'text-lime-400'],
        ].map(([label, value, tone]) => (
          <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-lg font-extrabold tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-[11px] text-red-400">
          {error}
        </div>
      )}

      {!onObjectStorage && (
        <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-orange-300">
          Object storage is not configured, so videos are still being written into the database — which is
          what filled its disk. Set the R2 variables before migrating.
        </div>
      )}

      {(Object.values(shrinks) as ShrinkStep[]).some(st => st.stage === 'done') && (
        <div className="mb-4 rounded-xl border border-lime-500/30 bg-lime-500/[0.06] p-3.5 space-y-1">
          {(Object.entries(shrinks) as [string, ShrinkStep][]).map(([id, st]) => st.stage === 'done' ? (
            <p key={id} className="text-[11px] text-slate-300 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
              <span className="truncate">{st.name}</span>
              <span className="text-slate-500 tabular-nums flex-shrink-0">{formatVideoSize(st.from)} → <b className="text-lime-400">{formatVideoSize(st.to)}</b></span>
            </p>
          ) : null)}
        </div>
      )}

      {heavy.length > 0 && (
        <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-3.5">
          <p className="text-[11px] font-bold text-orange-300 mb-1">
            {heavy.length === 1 ? '1 video is' : `${heavy.length} videos are`} too heavy for a phone
          </p>
          <p className="text-[10.5px] text-slate-400 leading-relaxed mb-2.5">
            These take the longest to load for clients. Shrink makes a 720p copy right here in your browser and
            shows it to you before anything is replaced.
          </p>
          {!canShrinkVideo() && (
            <p className="text-[10.5px] text-slate-500 mb-2.5">This browser cannot shrink videos here. Safari, Chrome or Edge can.</p>
          )}
          <ul className="space-y-2">
            {heavy.map(v => {
              const step = shrinks[v.id];
              return (
                <li key={v.id} className="text-[11px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-300 truncate">{v.name}</span>
                    <span className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="font-bold text-orange-400 tabular-nums">{formatVideoSize(v.bytes)}</span>
                      {canShrinkVideo() && (!step || step.stage === 'failed') && (
                        <button
                          onClick={() => startShrink(v)}
                          disabled={shrinkBusy}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-lime-500/10 border border-lime-500/30 text-lime-400 text-[10.5px] font-extrabold hover:bg-lime-500/20 disabled:opacity-40 transition-colors"
                        >
                          <Minimize2 className="w-3 h-3" /> {step?.stage === 'failed' ? 'Try again' : 'Shrink'}
                        </button>
                      )}
                    </span>
                  </div>
                  {step?.stage === 'downloading' && (
                    <p className="mt-1 flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Downloading
                      {step.total ? ` ${Math.round((step.received / step.total) * 100)}%` : ` ${formatVideoSize(step.received)}`}…
                    </p>
                  )}
                  {step?.stage === 'shrinking' && (
                    <div className="mt-1.5">
                      <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                        <div className="h-full bg-lime-500 transition-all" style={{ width: `${Math.round(step.fraction * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-slate-400">Shrinking to 720p… {Math.round(step.fraction * 100)}%</p>
                    </div>
                  )}
                  {step?.stage === 'ready' && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-wrap gap-3">
                      <video src={step.previewUrl} controls muted playsInline className="w-56 max-w-full rounded-md bg-black" />
                      <div className="flex-1 min-w-[180px] space-y-2">
                        <p className="text-slate-300">
                          <span className="font-bold text-orange-400">{formatVideoSize(step.originalBytes)}</span>
                          {' → '}
                          <span className="font-bold text-lime-400">{formatVideoSize(step.file.size)}</span>
                          <span className="text-slate-500"> · {step.width}×{step.height}</span>
                        </p>
                        <p className="text-slate-500 leading-relaxed">
                          Play it through first. Using it replaces the original, which is then deleted. The steps keep their timestamps.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => useShrunk(v, step)}
                            disabled={shrinkBusy}
                            className="px-3 py-1.5 rounded-md bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-slate-950 text-[10.5px] font-extrabold transition-colors"
                          >
                            Use the smaller one
                          </button>
                          <button
                            onClick={() => setShrink(v.id, null)}
                            className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-300 text-[10.5px] font-bold"
                          >
                            Keep the original
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {step?.stage === 'uploading' && (
                    <p className="mt-1 flex items-center gap-1.5 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Replacing the original…</p>
                  )}
                  {step?.stage === 'failed' && <p className="mt-1 text-red-400 leading-relaxed">{step.reason}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {state.pending > 0 ? (
        <>
          <button
            onClick={migrateAll}
            disabled={!onObjectStorage || working !== null}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold transition-colors"
          >
            {working === 'migrating'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {progress || 'Moving…'}</>
              : <><CloudUpload className="w-4 h-4" /> Move {state.pending} video{state.pending !== 1 ? 's' : ''} to object storage</>}
          </button>
          <p className="text-[10.5px] text-slate-500 mt-2 text-center">
            Copies only. Every database copy is left exactly where it is.
          </p>
        </>
      ) : state.bytesStillInDatabase > 0 ? (
        <>
          <div className="mb-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
            <p className="text-[11px] font-bold text-lime-400 flex items-center gap-1.5 mb-1">
              <Check className="w-3.5 h-3.5" /> All {state.migrated} videos are in object storage
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              They are also still in the database, holding {mb(state.bytesStillInDatabase)}. Play a few in the
              app first — the next step deletes the database copies and cannot be undone.
            </p>
          </div>
          {confirmPurge ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmPurge(false)}
                className="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={purge}
                disabled={working !== null}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-extrabold transition-colors"
              >
                {working === 'purging'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Freeing…</>
                  : <>Yes, delete the database copies</>}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmPurge(true)}
              disabled={working !== null}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-800/50 bg-red-950/30 text-red-400 hover:bg-red-950/50 text-xs font-extrabold transition-colors"
            >
              <AlertTriangle className="w-4 h-4" /> Free {mb(state.bytesStillInDatabase)} of database space
            </button>
          )}
        </>
      ) : (
        <div className="p-3 rounded-xl bg-lime-500/10 border border-lime-500/25">
          <p className="text-[11px] font-bold text-lime-400 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> No videos are stored in the database
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Videos live in object storage, so they can no longer fill the database disk.
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoStoragePanel;

import React, { useRef, useState } from 'react';
import { LibraryExercise, TutorialStep } from '../types';
import { X, UploadCloud, Play, Pause, Plus, ArrowUp, ArrowDown, Trash2, Timer, Flame, ShieldCheck } from 'lucide-react';

interface EditTutorialModalProps {
  exercise: LibraryExercise;
  onClose: () => void;
  onSave: (updated: LibraryExercise) => Promise<void>;
}

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

const EditTutorialModal: React.FC<EditTutorialModalProps> = ({ exercise, onClose, onSave }) => {
  const [steps, setSteps] = useState<TutorialStep[]>(
    exercise.steps && exercise.steps.length > 0 ? exercise.steps.map(s => ({ ...s })) : [{ text: '', time: null }]
  );
  const [videoUrl, setVideoUrl] = useState(exercise.tutorialVideoUrl || '');
  const [videoFileName, setVideoFileName] = useState(exercise.tutorialVideoFileName || '');
  const [previewStepIdx, setPreviewStepIdx] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [captionFading, setCaptionFading] = useState(false);
  const [harder, setHarder] = useState(exercise.makeHarder || '');
  const [easier, setEasier] = useState(exercise.makeEasier || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clampPreviewIdx = Math.min(previewStepIdx, steps.length - 1);

  const seekFromClientX = (clientX: number) => {
    const track = trackRef.current;
    const video = videoRef.current;
    if (!track || !video || !duration) return;
    const rect = track.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = frac * duration;
  };
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    seekFromClientX(e.clientX);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play(); else video.pause();
  };

  const handleVideoFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVideoUrl(reader.result);
        setVideoFileName(file.name);
        setDuration(0);
        setCurrentTime(0);
      }
    };
    reader.readAsDataURL(file);
  };
  const removeVideo = () => {
    setVideoUrl('');
    setVideoFileName('');
    setDuration(0);
    setCurrentTime(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const markStepTime = (i: number) => {
    const video = videoRef.current;
    if (!video) return;
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, time: Math.round(video.currentTime * 10) / 10 } : s)));
  };
  const clearStepTime = (i: number) => {
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, time: null } : s)));
  };
  const updateStepText = (i: number, text: string) => {
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, text } : s)));
  };
  const addStep = () => {
    setSteps(prev => [...prev, { text: '', time: null }]);
    setPreviewStepIdx(steps.length);
  };
  const removeStep = (i: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, idx) => idx !== i));
    setPreviewStepIdx(prev => Math.min(prev, steps.length - 2));
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setPreviewStepIdx(prev => (prev === i ? j : prev === j ? i : prev));
  };
  const focusStep = (i: number) => {
    setPreviewStepIdx(i);
    const video = videoRef.current;
    const t = steps[i]?.time;
    if (video && t != null) video.currentTime = t;
  };

  const previewNext = () => {
    if (clampPreviewIdx >= steps.length - 1) return;
    const video = videoRef.current;
    const target = steps[clampPreviewIdx + 1];
    if (video && target && target.time != null) {
      const targetTime = target.time;
      setCaptionFading(true);
      const onTime = () => {
        if (video.currentTime >= targetTime) {
          video.pause();
          video.removeEventListener('timeupdate', onTime);
          setPreviewStepIdx(i => i + 1);
          setCaptionFading(false);
        }
      };
      video.addEventListener('timeupdate', onTime);
      video.play();
    } else {
      setPreviewStepIdx(i => i + 1);
    }
  };
  const previewPrev = () => {
    if (clampPreviewIdx <= 0) return;
    const prevIdx = clampPreviewIdx - 1;
    const video = videoRef.current;
    const t = steps[prevIdx]?.time;
    if (video && t != null) video.currentTime = t;
    setPreviewStepIdx(prevIdx);
  };

  const handleSave = async () => {
    const cleanSteps = steps.filter(s => s.text.trim());
    if (cleanSteps.length === 0) {
      setError('Add at least one step.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        ...exercise,
        tutorialVideoUrl: videoUrl,
        tutorialVideoFileName: videoFileName,
        steps: cleanSteps,
        makeHarder: harder.trim(),
        makeEasier: easier.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const fillPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex-shrink-0">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Timer className="w-4 h-4 text-lime-400" />
            <span>Edit Tutorial — {exercise.name}</span>
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Video + timeline + live caption preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tutorial Video &amp; Timeline</label>
              <span className="text-[8.5px] font-extrabold uppercase tracking-wide text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full">● Live preview</span>
            </div>

            {!videoUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-lime-500/60 rounded-xl p-6 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-lime-500/20 text-slate-400 group-hover:text-lime-400 mx-auto flex items-center justify-center mb-2 transition-colors">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-300 group-hover:text-white">Click to upload a video</p>
                <p className="text-[10px] text-slate-500 mt-0.5">MP4 or MOV, showing the full movement</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-slate-800">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60">
                  <span className="text-[11px] font-bold text-slate-300 truncate max-w-[240px]">🎬 {videoFileName || 'video file'}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-[10px] font-bold hover:border-lime-500/50 hover:text-lime-400">Replace</button>
                    <button type="button" onClick={removeVideo} className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-[10px] font-bold hover:border-red-500/50 hover:text-red-400">Remove</button>
                  </div>
                </div>

                <div className="relative aspect-video bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                    onPlay={() => setVideoPlaying(true)}
                    onPause={() => setVideoPlaying(false)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/40 to-transparent pointer-events-none" />
                  {videoPlaying && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-white bg-lime-500/25 border border-lime-500/60 px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" /> Playing&hellip;
                    </div>
                  )}
                  <div className={`absolute inset-x-0 bottom-0 p-3 transition-opacity duration-200 ${captionFading ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/60">Step {clampPreviewIdx + 1} of {steps.length}</span>
                      <div className="flex gap-1">
                        {steps.map((_, i) => (
                          <span key={i} className={`h-[3px] rounded-full transition-all ${i === clampPreviewIdx ? 'w-4 bg-lime-400' : i < clampPreviewIdx ? 'w-2.5 bg-lime-500/60' : 'w-2.5 bg-white/25'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-white leading-snug mb-2" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
                      {steps[clampPreviewIdx]?.text?.trim() || 'Type a step below to see it here…'}
                    </p>
                    <div className="flex gap-1.5">
                      <button onClick={previewPrev} disabled={clampPreviewIdx === 0} className="px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold bg-white/10 border border-white/20 text-white disabled:opacity-30">←</button>
                      <button onClick={previewNext} disabled={clampPreviewIdx >= steps.length - 1} className="flex-1 py-1.5 rounded-lg text-[10.5px] font-extrabold bg-lime-500 text-slate-950 disabled:opacity-30">Next Step →</button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-950/40">
                  <button type="button" onClick={togglePlay} className="w-7 h-7 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:border-lime-500/50 hover:text-lime-400 flex items-center justify-center flex-shrink-0">
                    {videoPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                  </button>
                  <div
                    ref={trackRef}
                    onPointerDown={handleTrackPointerDown}
                    onPointerMove={handleTrackPointerMove}
                    className="relative flex-1 h-5 cursor-pointer flex items-center touch-none"
                  >
                    <div className="absolute left-0 right-0 h-[5px] rounded-full bg-slate-800" />
                    <div className="absolute left-0 h-[5px] rounded-full bg-lime-500/40 pointer-events-none" style={{ width: `${fillPct}%` }} />
                    <div className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-lime-400 border-2 border-slate-950 pointer-events-none" style={{ left: `${fillPct}%`, transform: 'translate(-50%, -50%)' }} />
                    {duration > 0 && steps.map((s, i) => {
                      if (s.time == null) return null;
                      const pct = Math.min(100, (s.time / duration) * 100);
                      return (
                        <div
                          key={i}
                          onPointerDown={e => { e.stopPropagation(); }}
                          onClick={e => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = s.time as number; }}
                          title={`Step ${i + 1} — ${formatTime(s.time)}`}
                          className="absolute top-1/2 w-4 h-4 rounded flex items-center justify-center text-[8px] font-extrabold bg-sky-500 text-white border-[1.5px] border-slate-900 cursor-pointer z-10"
                          style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          {i + 1}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-500 tabular-nums flex-shrink-0">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={e => handleVideoFile(e.target.files?.[0])} accept="video/*" className="hidden" />
            <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5">
              Play or drag through the timeline, then hit &ldquo;Mark&rdquo; on a step below to set exactly where it should pause.
            </p>
          </div>

          {/* Step editor */}
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Step by Step</label>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const hasTime = s.time != null;
                return (
                  <div key={i} className={`flex items-center gap-1.5 rounded-lg transition-colors ${i === clampPreviewIdx ? 'bg-sky-500/5' : ''}`}>
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-lime-400 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                    <input
                      type="text"
                      value={s.text}
                      onChange={e => updateStepText(i, e.target.value)}
                      onFocus={() => focusStep(i)}
                      placeholder="Describe this step..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-lime-500/50 min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => markStepTime(i)}
                      disabled={!videoUrl}
                      title="Set this step's stop point to the video's current position"
                      className={`flex-shrink-0 flex items-center gap-1 px-2 py-2 rounded-lg text-[9.5px] font-extrabold border transition-colors disabled:opacity-30 ${
                        hasTime ? 'border-sky-500/40 bg-sky-500/10 text-sky-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-sky-500/50 hover:text-sky-400'
                      }`}
                    >
                      <Timer className="w-3 h-3" />
                      {hasTime ? formatTime(s.time as number) : 'Mark'}
                      {hasTime && (
                        <span onClick={e => { e.stopPropagation(); clearStepTime(i); }} className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-400">
                          <X className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button type="button" onClick={() => moveStep(i, -1)} title="Move up" className="w-6 h-6 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center"><ArrowUp className="w-3 h-3" /></button>
                      <button type="button" onClick={() => moveStep(i, 1)} title="Move down" className="w-6 h-6 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center"><ArrowDown className="w-3 h-3" /></button>
                      <button type="button" onClick={() => removeStep(i)} title="Remove step" className="w-6 h-6 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addStep} className="w-full mt-2 py-2 border border-dashed border-slate-700 rounded-lg text-slate-400 text-[11px] font-bold hover:border-lime-500/40 hover:text-lime-400 transition-colors flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Step
            </button>
          </div>

          {/* Harder / Easier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl border border-amber-500/20 bg-slate-950/30">
              <label className="block text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Harder
              </label>
              <textarea value={harder} onChange={e => setHarder(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500/50 resize-none" />
            </div>
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-slate-950/30">
              <label className="block text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Easier
              </label>
              <textarea value={easier} onChange={e => setEasier(e.target.value)} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500/50 resize-none" />
            </div>
          </div>

          {error && <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400">{error}</div>}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end space-x-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 border border-slate-800 transition-colors min-h-[44px]">Cancel</button>
          <button type="button" disabled={saving} onClick={handleSave} className="px-5 py-2.5 bg-lime-500 hover:bg-lime-400 rounded-xl text-xs font-bold text-slate-950 shadow-md shadow-lime-500/20 min-h-[44px] disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Tutorial'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTutorialModal;

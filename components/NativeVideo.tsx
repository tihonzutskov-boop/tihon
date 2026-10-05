import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { nextVideoLoadPhase, canPreload, SLOW_AFTER_MS, type VideoLoadPhase, type VideoLoadEvent } from '../utils/videoLoad';

interface NativeVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'ref' | 'src'> {
  src: string;
  /** For a caller that drives playback itself (the step-by-step tutorial seeks and plays it). */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

// An uploaded tutorial video that says what it is doing. It sits in a relatively
// positioned parent, which the overlay fills. Until a video has bytes a browser
// shows a black box, and a video that takes ten seconds looks the same as one that
// will never come; this shows a spinner, then says it is taking longer than usual
// and offers another try, and says so plainly when it fails.
const NativeVideo: React.FC<NativeVideoProps> = ({ src, videoRef, className, ...rest }) => {
  const ownRef = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? ownRef;
  const [phase, setPhase] = useState<VideoLoadPhase>('loading');
  // Bumped to run the effect again on a retry, which restarts the slow timer.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setPhase(p => nextVideoLoadPhase(p, 'slowTimer')), SLOW_AFTER_MS);
    };
    const on = (event: VideoLoadEvent) => () => {
      setPhase(p => nextVideoLoadPhase(p, event));
      if (event === 'start' || event === 'waiting') arm();
      if (event === 'canplay' || event === 'error') clearTimeout(timer);
    };
    const handlers: [string, () => void][] = [
      ['loadstart', on('start')], ['canplay', on('canplay')], ['playing', on('canplay')],
      ['waiting', on('waiting')], ['error', on('error')],
    ];
    handlers.forEach(([name, fn]) => video.addEventListener(name, fn));
    // Already has data (a cached or preloaded video): nothing to wait for.
    if (video.readyState >= 3) setPhase('ready');
    else { setPhase('loading'); arm(); }
    return () => {
      clearTimeout(timer);
      handlers.forEach(([name, fn]) => video.removeEventListener(name, fn));
    };
  }, [src, attempt, ref]);

  const retry = () => {
    setPhase(p => nextVideoLoadPhase(p, 'retry'));
    setAttempt(a => a + 1);
    ref.current?.load();
  };

  return (
    <>
      <video ref={ref} src={src} preload="auto" className={className} {...rest} />
      {phase !== 'ready' && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center"
        >
          {phase === 'error' ? (
            <p className="text-xs font-bold text-red-300">Couldn't load this video.</p>
          ) : (
            <>
              <Loader2 className="w-6 h-6 text-lime-400 animate-spin" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-200">
                {phase === 'slow' ? 'Still loading. This is taking longer than usual.' : 'Loading video…'}
              </p>
            </>
          )}
          {(phase === 'slow' || phase === 'error') && (
            <button
              type="button"
              onClick={retry}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-slate-950 text-[11px] font-extrabold px-3 py-1.5 transition-colors"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default NativeVideo;

/**
 * Loads tutorial videos ahead of when they are wanted, so the next exercise's is
 * already arriving while the current one is read. Nothing is shown. Skipped on
 * data saver or a 2G connection, where loading what nobody has asked for yet
 * would cost more than it saves. A browser that does not preload hidden videos
 * (iPhones do not) simply loads them when they are shown, as before.
 */
export const VideoPreloader: React.FC<{ urls: string[] }> = ({ urls }) => {
  const connection = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
  if (urls.length === 0 || !canPreload(connection)) return null;
  return (
    <div hidden aria-hidden="true">
      {urls.map(url => <video key={url} src={url} preload="auto" muted playsInline />)}
    </div>
  );
};

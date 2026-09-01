import React, { useMemo, useState } from 'react';
import { LibraryExercise, MovementPattern, EquipmentItem } from '../types';
import { deriveMuscleGroups, deriveExerciseCategory, suggestMovementPattern, suggestEquipmentIds } from '../utils/exerciseTagDerivation';
import { Loader2 } from 'lucide-react';

const PATTERNS: MovementPattern[] = [
  'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
  'squat', 'hinge', 'lunge', 'carry', 'core', 'conditioning', 'mobility',
];
// The patterns a default blueprint marks required. Anything missing here
// means generation fails for clients at that day count, so it's worth
// answering on this screen rather than discovering it in the Issues queue.
const REQUIRED_FOR_4_DAY: MovementPattern[] = ['horizontal_push', 'horizontal_pull', 'squat', 'hinge'];

const label = (s: string) => s.replace(/_/g, ' ');

// One row's working state. Everything except the pattern is derived, so the
// pattern is all this screen actually asks the admin to decide.
interface Row {
  ex: LibraryExercise;
  pattern: MovementPattern | '';
  suggested: MovementPattern | '';
  enabled: boolean;
}

const buildRow = (ex: LibraryExercise): Row => {
  const suggested = suggestMovementPattern(ex.name) as MovementPattern | '';
  return {
    ex,
    pattern: (ex.movementPattern as MovementPattern) || suggested,
    suggested,
    enabled: ex.generationEnabled === true,
  };
};

interface BulkTaggingTableProps {
  exercises: LibraryExercise[];
  equipmentList: EquipmentItem[];
  onSave: (updated: LibraryExercise[]) => Promise<void>;
}

const Chip: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({ children, muted }) => (
  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mr-1 mb-0.5 ${
    muted ? 'bg-slate-950 border border-slate-800 text-slate-600' : 'bg-lime-500/8 border border-lime-500/25 text-lime-400'
  }`}>{children}</span>
);

const BulkTaggingTable: React.FC<BulkTaggingTableProps> = ({ exercises, equipmentList, onSave }) => {
  const [rows, setRows] = useState<Row[]>(() => exercises.map(buildRow));
  const [filter, setFilter] = useState<'all' | 'untagged' | 'ready'>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const equipmentMap = useMemo(
    () => new Map(equipmentList.map(e => [e.id, e.name])),
    [equipmentList]
  );

  // A row can only be enabled once it has both the things eligibility needs.
  const derivedType = (ex: LibraryExercise) => ex.exerciseCategory || deriveExerciseCategory(ex.category);
  const canEnable = (r: Row) => !!r.pattern && !!derivedType(r.ex);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => {
      if (filter === 'untagged') return !r.pattern;
      if (filter === 'ready') return canEnable(r);
      return true;
    });

  const enabledCount = rows.filter(r => r.enabled).length;
  const suggestedCount = rows.filter(r => r.suggested).length;
  const unsetCount = rows.filter(r => !r.pattern).length;
  const coveredPatterns = new Set(rows.filter(r => r.enabled).map(r => r.pattern));
  const missing = REQUIRED_FOR_4_DAY.filter(p => !coveredPatterns.has(p));

  const acceptAllSuggestions = () =>
    setRows(prev => prev.map(r => (r.suggested && !r.pattern ? { ...r, pattern: r.suggested } : r)));
  const enableAllTagged = () =>
    setRows(prev => prev.map(r => (canEnable(r) ? { ...r, enabled: true } : r)));

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      // Only exercises that actually changed are sent — the rest are left
      // untouched rather than rewritten with identical values.
      const changed = rows
        .filter(r => r.pattern !== (r.ex.movementPattern || '') || r.enabled !== (r.ex.generationEnabled === true))
        .map(r => ({
          ...r.ex,
          movementPattern: r.pattern || undefined,
          // Fill the derivable fields at the same time, so tagging here
          // leaves an exercise as complete as editing it individually would.
          exerciseCategory: r.ex.exerciseCategory || deriveExerciseCategory(r.ex.category) || undefined,
          primaryMuscles: (r.ex.primaryMuscles && r.ex.primaryMuscles.length > 0)
            ? r.ex.primaryMuscles
            : deriveMuscleGroups(r.ex.targetMuscle),
          generationEnabled: r.enabled,
        }));
      if (changed.length === 0) { setSaving(false); return; }
      await onSave(changed);
      setRows(prev => prev.map(r => ({
        ...r,
        ex: { ...r.ex, movementPattern: r.pattern || undefined, generationEnabled: r.enabled },
      })));
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const dirty = rows.some(r =>
    r.pattern !== (r.ex.movementPattern || '') || r.enabled !== (r.ex.generationEnabled === true));

  return (
    <div className="pb-8">
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-3.5">
        <div className="flex-shrink-0">
          <div className="text-[22px] font-extrabold leading-none">
            {enabledCount}<span className="text-xs font-bold text-slate-500">/{rows.length}</span>
          </div>
          <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide mt-1">Enabled</div>
        </div>
        <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
          <div className="h-full bg-lime-500 rounded-full transition-all" style={{ width: `${rows.length ? (enabledCount / rows.length) * 100 : 0}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-[280px] flex-shrink-0">
          {missing.length === 0
            ? <><b className="text-lime-400">Ready to generate.</b> Every pattern a 4-day plan requires is covered.</>
            : <>Still missing for a 4-day plan: <b className="text-amber-400">{missing.map(label).join(', ')}</b></>}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button onClick={acceptAllSuggestions} className="px-3.5 py-2 rounded-lg bg-lime-500 hover:bg-lime-400 text-slate-950 text-[11.5px] font-extrabold transition-colors">
          ✓ Accept all suggestions
        </button>
        <button onClick={enableAllTagged} className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-300 text-[11.5px] font-bold transition-colors">
          Enable all tagged
        </button>
        <div className="flex-1" />
        {(['all', 'untagged', 'ready'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
              filter === f ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300'
            }`}
          >
            {f === 'all' ? `All ${rows.length}` : f === 'untagged' ? `Needs a pattern${unsetCount ? ` · ${unsetCount}` : ''}` : 'Ready'}
          </button>
        ))}
      </div>

      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-950">
              {['Exercise', 'Movement pattern', 'Type', 'Muscles', 'Equipment', ''].map((h, i) => (
                <th key={i} className="text-left text-[9px] font-extrabold text-slate-500 uppercase tracking-wider px-3.5 py-2.5 border-b border-slate-800 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-3.5 py-8 text-center text-xs text-slate-500">Nothing here.</td></tr>
            )}
            {visible.map(({ r, i }) => {
              const type = derivedType(r.ex);
              const muscles = (r.ex.primaryMuscles && r.ex.primaryMuscles.length > 0)
                ? r.ex.primaryMuscles
                : deriveMuscleGroups(r.ex.targetMuscle);
              const equipIds = (r.ex.requiredEquipmentIds && r.ex.requiredEquipmentIds.length > 0)
                ? r.ex.requiredEquipmentIds
                : suggestEquipmentIds(r.ex.name, r.ex.equipmentRequired, equipmentList);
              const enableable = canEnable(r);
              return (
                <tr key={r.ex.id} className={`border-b border-slate-800/60 last:border-none transition-colors ${r.enabled ? 'bg-lime-500/[0.035]' : 'hover:bg-slate-800/20'}`}>
                  <td className="px-3.5 py-2.5 align-middle">
                    <div className="text-[12.5px] font-bold text-white">{r.ex.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{r.ex.targetMuscle} · {r.ex.category}</div>
                  </td>
                  <td className="px-3.5 py-2.5 align-middle">
                    <select
                      value={r.pattern}
                      onChange={e => {
                        const v = e.target.value as MovementPattern | '';
                        update(i, { pattern: v, ...(v ? {} : { enabled: false }) });
                      }}
                      className={`bg-slate-950 border rounded-lg px-2 py-1.5 text-[11px] font-bold min-w-[150px] cursor-pointer focus:outline-none focus:border-sky-500 transition-colors ${
                        !r.pattern ? 'border-slate-800 text-slate-500'
                          : r.pattern === r.suggested ? 'border-lime-500/45 text-lime-400'
                          : 'border-slate-700 text-white'
                      }`}
                    >
                      <option value="">— choose —</option>
                      {PATTERNS.map(p => <option key={p} value={p} className="bg-slate-950 text-white">{label(p)}</option>)}
                    </select>
                    <span className={`block text-[9px] font-bold mt-1 ${r.suggested ? 'text-lime-400' : 'text-slate-600'}`}>
                      {r.suggested ? 'suggested from name' : "name doesn't say — pick one"}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 align-middle">
                    {type ? <Chip>{type}</Chip> : <Chip muted>—</Chip>}
                  </td>
                  <td className="px-3.5 py-2.5 align-middle">
                    {muscles.length > 0 ? muscles.map(m => <Chip key={m}>{m}</Chip>) : <Chip muted>—</Chip>}
                  </td>
                  <td className="px-3.5 py-2.5 align-middle">
                    {equipIds.length > 0
                      ? <Chip>{equipmentMap.get(equipIds[0]) || equipIds[0]}{equipIds.length > 1 ? ` +${equipIds.length - 1}` : ''}</Chip>
                      : <Chip muted>—</Chip>}
                  </td>
                  <td className="px-3.5 py-2.5 align-middle">
                    <button
                      onClick={() => update(i, { enabled: !r.enabled })}
                      disabled={!enableable}
                      title={enableable ? '' : 'Needs a movement pattern first'}
                      className={`px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold whitespace-nowrap transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                        r.enabled ? 'bg-lime-500 text-slate-950' : 'bg-slate-950 border border-slate-800 text-slate-400'
                      }`}
                    >
                      {r.enabled ? '✓ On' : 'Off'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-400">{error}</div>
      )}

      <div className="flex items-center gap-3 mt-4">
        <p className="text-[11px] text-slate-500 leading-relaxed flex-1">
          <b className="text-slate-400">{suggestedCount} of {rows.length}</b> patterns pre-filled from the exercise name
          {unsetCount > 0 && <> · <b className="text-slate-400">{unsetCount}</b> still need a choice</>}
          {' '}· everything else derived automatically.
        </p>
        {savedAt && !dirty && <span className="text-[11px] font-bold text-lime-400">✓ Saved</span>}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saving ? 'Saving…' : 'Save all changes'}
        </button>
      </div>
    </div>
  );
};

export default BulkTaggingTable;

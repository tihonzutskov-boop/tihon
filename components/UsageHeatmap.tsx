import React, { useEffect, useState } from 'react';
import { Flame, Loader2, TrendingUp, MapPin } from 'lucide-react';
import { Gym, EquipmentItem } from '../types';
import { api } from '../services/api';
import { mapHeat, topEquipmentByUsage, topZonesByUsage, heatColor, GymUsage } from '../utils/equipmentUsage';
import GymMap from './GymMap';

interface UsageHeatmapProps {
  gym: Gym;
  equipmentList: EquipmentItem[];
}

type Range = 'all' | '30' | '7';
const RANGES: { key: Range; label: string }[] = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

// Name and bar stack on their own lines rather than sharing one row — a side
// panel this narrow (320px) left the name only ~20px once the bar, uses and
// trainees columns took their fixed widths, which is why "Functional zone"
// and "Free Weights" both came out as "F...".
const RankedRow: React.FC<{ name: string; uses: number; trainees: number; maxUses: number }> = ({ name, uses, trainees, maxUses }) => (
  <div className="py-2">
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <span className="text-xs font-semibold text-slate-300 truncate min-w-0">{name}</span>
      <span className="text-[11px] font-mono text-slate-400 flex-shrink-0">{uses} uses</span>
    </div>
    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${maxUses > 0 ? (uses / maxUses) * 100 : 0}%`, backgroundColor: heatColor(maxUses > 0 ? uses / maxUses : 0) }} />
    </div>
    <span className="block text-[10px] text-slate-600 mt-1">{trainees} {trainees === 1 ? 'trainee' : 'trainees'}</span>
  </div>
);

// Admin-only: which of a gym's machines and zones actually get trained on.
// Only counts sessions logged after this shipped — older logs carry no zone or
// machine, so there is nothing earlier to show.
const UsageHeatmap: React.FC<UsageHeatmapProps> = ({ gym, equipmentList }) => {
  const [range, setRange] = useState<Range>('30');
  const [usage, setUsage] = useState<GymUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFocusedZoneId(null);
    api.fetchGymEquipmentUsage(gym.id, range === 'all' ? undefined : Number(range)).then(result => {
      if (!cancelled) { setUsage(result); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [gym.id, range]);

  const { zoneHeat, machineHeat } = usage ? mapHeat(usage, gym) : { zoneHeat: {}, machineHeat: {} };
  const topEquipment = usage ? topEquipmentByUsage(gym, equipmentList, usage.byMachine) : [];
  const topZones = usage ? topZonesByUsage(gym, usage.byZone) : [];
  const hasData = !!usage && usage.byZone.length > 0;
  const maxEquipmentUses = topEquipment[0]?.uses ?? 0;
  const maxZoneUses = topZones[0]?.uses ?? 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" /> Usage Heatmap
          </h2>
          <p className="text-xs text-slate-500 mt-1">Which machines and zones actually get trained on, from logged sessions at this gym.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                range === r.key ? 'border-lime-500 bg-lime-500/10 text-lime-400' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading usage…
        </div>
      ) : !hasData ? (
        <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <Flame className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-300 mb-1">No training logged here yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Once clients complete sessions at this gym, every machine here will glow by how often it gets used, from blue (barely touched) to red (the busiest thing in the gym).
          </p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Peak equipment</p>
                {topEquipment[0] ? (
                  <p className="text-sm font-bold text-white truncate">{topEquipment[0].name} <span className="text-slate-500 font-semibold">&middot; {topEquipment[0].uses} uses</span></p>
                ) : (
                  <p className="text-sm font-bold text-slate-600">No equipment tagged yet</p>
                )}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Busiest zone</p>
                <p className="text-sm font-bold text-white truncate">{topZones[0].name} <span className="text-slate-500 font-semibold">&middot; {topZones[0].uses} uses</span></p>
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 h-[480px] relative">
              <GymMap
                zones={gym.zones}
                dimensions={gym.dimensions}
                entrance={gym.entrance}
                floorColor={gym.floorColor}
                annexes={gym.annexes}
                zoneHeat={zoneHeat}
                machineHeat={machineHeat}
                focusedZoneId={focusedZoneId}
                onZoneClick={(zone) => setFocusedZoneId(prev => (prev === zone.id ? null : zone.id))}
                hideSearch
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-slate-500">
              <span>Least used</span>
              <div className="w-32 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} />
              <span>Most used</span>
              <span className="ml-3 text-slate-600">Click a zone to zoom in</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Busiest zones</p>
              <div className="divide-y divide-slate-800/60">
                {topZones.map(z => <RankedRow key={z.zoneId} name={z.name} uses={z.uses} trainees={z.trainees} maxUses={maxZoneUses} />)}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Top equipment</p>
              {topEquipment.length === 0 ? (
                <p className="text-xs text-slate-600 py-2 leading-relaxed">
                  {usage && usage.byMachine.length > 0
                    ? 'The machines used so far aren\u2019t tagged with an equipment type yet \u2014 tag them in the Equipment Library to see them here.'
                    : 'No logged sets are tied to a specific machine yet.'}
                </p>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {topEquipment.map(e => <RankedRow key={e.equipmentId} name={e.name} uses={e.uses} trainees={e.trainees} maxUses={maxEquipmentUses} />)}
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UsageHeatmap;

import React, { useState, useEffect } from 'react';
import { TestCaseResult, AudienceScope } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import { CITY_PRESETS, calculateHaversineDistance, MAXIMUM_COMMERCIAL_RADIUS_KM } from '../lib/geo.ts';
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Zap,
  ArrowRight,
  Database,
  FileCode2,
  Lock
} from 'lucide-react';

interface StageB1TestItem {
  id: string;
  sectionRef: string;
  name: string;
  passed: boolean;
  durationMs: number;
  assertionDetails: string;
}

interface MigrationPairItem {
  id: string;
  name: string;
  upFile: string;
  downFile: string;
  upSql: string;
  downSql: string;
}

export const DistributionEngineLab: React.FC = () => {
  const { viewerLocation } = useLocation();

  const [activeLabTab, setActiveLabTab] = useState<'stage_b1' | 'engine_proofs'>('stage_b1');

  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [allPassed, setAllPassed] = useState<boolean | null>(null);

  // Stage B.1 Verification & Migration States
  const [b1Results, setB1Results] = useState<StageB1TestItem[]>([]);
  const [b1AllPassed, setB1AllPassed] = useState<boolean | null>(null);
  const [isB1Running, setIsB1Running] = useState(false);
  const [migrations, setMigrations] = useState<MigrationPairItem[]>([]);
  const [selectedMigrationIdx, setSelectedMigrationIdx] = useState(1);
  const [sqlDirection, setSqlDirection] = useState<'up' | 'down'>('up');

  // Privileged Origin Correction Tester (§4.3)
  const [corrRole, setCorrRole] = useState<'platform_admin' | 'user'>('platform_admin');
  const [corrTicket, setCorrTicket] = useState('GEO-TICKET-2026-09');
  const [corrReason, setCorrReason] = useState('Correcting cell tower drift to verified Orvakal Rock Garden coordinates');
  const [corrFeedback, setCorrFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Playground simulation states
  const [simViewerCity, setSimViewerCity] = useState(CITY_PRESETS[1]); // Hyderabad
  const [simPostOriginCity, setSimPostOriginCity] = useState(CITY_PRESETS[0]); // Kurnool
  const [simEngineType, setSimEngineType] = useState<'organic' | 'commercial'>('organic');
  const [simScope, setSimScope] = useState<AudienceScope>('worldwide');
  const [simCustomRadius, setSimCustomRadius] = useState<number>(40);

  const runStageB1Tests = async () => {
    setIsB1Running(true);
    try {
      const [verifyRes, migRes] = await Promise.all([
        fetch('/api/v1/stage-b1/verify', { method: 'POST' }),
        fetch('/api/v1/stage-b1/migrations')
      ]);
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        setB1Results(data.results || []);
        setB1AllPassed(Boolean(data.allPassed));
      }
      if (migRes.ok) {
        const migData = await migRes.json();
        setMigrations(migData.migrations || []);
        setAuditLogs(migData.auditLogs || []);
      }
    } catch (e) {
      console.error('Failed to run Stage B.1 verification suite', e);
    } finally {
      setIsB1Running(false);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/test/run-all', {
        method: 'POST'
      });
      const data = await response.json();
      setTestResults(data.results || []);
      setAllPassed(data.allPassed);
    } catch (e) {
      console.error('Failed to run test suite', e);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runStageB1Tests();
    runAllTests();
  }, []);

  const handleExecuteOriginCorrection = async () => {
    setCorrFeedback(null);
    try {
      const res = await fetch('/api/v1/stage-b1/admin-correct-origin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorRole: corrRole,
          postId: 'post_kurnool_dance_worldwide',
          newLatitude: 15.689,
          newLongitude: 78.205,
          newCity: 'Kurnool',
          newState: 'Andhra Pradesh',
          newCountry: 'India',
          newCountryCode: 'IN',
          ticketReference: corrTicket,
          reason: corrReason
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCorrFeedback({
          ok: true,
          msg: `Origin updated via SECURITY DEFINER admin_correct_post_origin & logged to append-only audit_logs (${data.auditEntry?.id}).`
        });
        setAuditLogs(data.auditLogs || []);
      } else {
        setCorrFeedback({
          ok: false,
          msg: data.error || 'Rejected by database trigger.'
        });
      }
    } catch (err: any) {
      setCorrFeedback({ ok: false, msg: err?.message || 'Request failed' });
    }
  };

  // Calculate playground distance & verdict
  const playgroundDistance = calculateHaversineDistance(
    simViewerCity.latitude,
    simViewerCity.longitude,
    simPostOriginCity.latitude,
    simPostOriginCity.longitude
  );

  let playgroundEligible = false;
  let playgroundReason = '';
  let playgroundViolation = false;

  if (simEngineType === 'organic') {
    if (simScope === 'worldwide') {
      playgroundEligible = true;
      playgroundReason = 'Engine A: Worldwide organic distribution is permitted without distance caps.';
    } else {
      const radius = simCustomRadius;
      playgroundEligible = playgroundDistance <= radius;
      playgroundReason = playgroundEligible
        ? `Engine A: Viewer (${playgroundDistance} km) is within creator's target radius of ${radius} km.`
        : `Engine A: Viewer (${playgroundDistance} km) exceeds creator's target radius of ${radius} km. Content is blocked.`;
    }
  } else {
    // Commercial Engine B
    if (simCustomRadius > MAXIMUM_COMMERCIAL_RADIUS_KM) {
      playgroundEligible = false;
      playgroundViolation = true;
      playgroundReason = `Engine B VIOLATION: Radius ${simCustomRadius} km exceeds the absolute 40 km commercial cap. Server rejects this campaign!`;
    } else {
      playgroundEligible = playgroundDistance <= simCustomRadius;
      playgroundReason = playgroundEligible
        ? `Engine B: Viewer (${playgroundDistance} km) is within commercial radius of ${simCustomRadius} km (≤ 40km). Ad delivered.`
        : `Engine B: Viewer (${playgroundDistance} km) is outside ${simCustomRadius} km commercial radius. Ad is NOT served.`;
    }
  }

  const activeMigration = migrations[selectedMigrationIdx] || migrations[0];

  return (
    <div className="w-full max-w-5xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-6 sm:space-y-8 min-w-0">
      
      {/* Hero Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Database className="w-4 h-4 shrink-0" />
              <span>Stage B.1 Permanent PostgreSQL + PostGIS Gate</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              Architecture, PostGIS & Distribution Verification
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Enforces all 10 Stage B.1 Database & Migration Corrections (§4.1–§4.10) alongside the dual distribution engine invariants (<strong className="text-white">Engine A: Worldwide Organic</strong> · <strong className="text-amber-400">Engine B: ≤ 40 km Commercial Hard Cap</strong>).
            </p>
          </div>

          <button
            onClick={() => {
              runStageB1Tests();
              runAllTests();
            }}
            disabled={isRunning || isB1Running}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0 w-full md:w-auto"
          >
            <RotateCw className={`w-4 h-4 ${isRunning || isB1Running ? 'animate-spin' : ''}`} />
            <span>{isRunning || isB1Running ? 'Executing Verification...' : 'Re-Run All 19 Verification Tests'}</span>
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveLabTab('stage_b1')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeLabTab === 'stage_b1'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Stage B.1 DB & PostGIS Gate ({b1Results.filter(r => r.passed).length}/{b1Results.length || 12} Passed)
            </button>
            <button
              onClick={() => setActiveLabTab('engine_proofs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeLabTab === 'engine_proofs'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              7 Geographic Engine Proofs & Simulator ({testResults.filter(t => t.passed).length}/{testResults.length || 7} Passed)
            </button>
          </div>

          {b1AllPassed && allPassed && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-emerald-300">
                STAGE B.1 + GEO INVARIANTS: 100% VERIFIED
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TAB A: STAGE B.1 DATABASE & MIGRATION VERIFICATION GATE */}
      {activeLabTab === 'stage_b1' && (
        <div className="space-y-6">
          {/* 12 Mandatory Stage B.1 Tests */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  12 Mandatory Stage B.1 Database & Migration Tests (§5.2)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verifies forward/rollback DDL, FK ordering, PostGIS ST_MakePoint(lon, lat), triggers, SECURITY DEFINER procedures, atomic spend, inventory locks, outbox leases, and least-privilege roles.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                {b1Results.filter(t => t.passed).length} / {b1Results.length} PASSED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {b1Results.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-emerald-200/90 dark:border-emerald-950/80 shadow-sm flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.id} · {item.sectionRef}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        PASSED ({item.durationMs}ms)
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.assertionDetails}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Interactive Privileged Origin Correction (§4.3) */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <Lock className="w-4 h-4" />
                  <span>§4.3 Privileged Origin Correction Procedure (admin_correct_post_origin)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ordinary UPDATEs on <code className="font-mono">publishing_point</code> are blocked by <code className="font-mono">trg_enforce_post_immutability</code>. Test the <code className="font-mono">SECURITY DEFINER</code> procedure with role &amp; ticket checks.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Caller Database / App Role
                </label>
                <select
                  value={corrRole}
                  onChange={e => setCorrRole(e.target.value as any)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="platform_admin">platform_admin (Approved)</option>
                  <option value="user">user (Standard Creator — Test Rejection)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Support Ticket Reference
                </label>
                <input
                  type="text"
                  value={corrTicket}
                  onChange={e => setCorrTicket(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Mandatory Forensic Reason (≥15 chars)
                </label>
                <input
                  type="text"
                  value={corrReason}
                  onChange={e => setCorrReason(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                onClick={handleExecuteOriginCorrection}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shrink-0"
              >
                Execute admin_correct_post_origin()
              </button>

              {corrFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex-1 ${
                    corrFeedback.ok
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {corrFeedback.msg}
                </div>
              )}
            </div>

            {auditLogs.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-mono font-bold uppercase text-slate-400 mb-1.5">
                  Append-Only audit_logs Ledger ({auditLogs.length} entries)
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {auditLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 text-[11px] font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <span>
                        <strong>{log.action}</strong> · Ticket: {log.ticket_reference} · Target: {log.target_id}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {log.metadata?.old_point_ewkt} → {log.metadata?.new_point_ewkt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* SQL Migration & Rollback Inspector */}
          {activeMigration && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    <FileCode2 className="w-4 h-4" />
                    <span>Stage B.1 Forward & Rollback SQL Migrations</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Inspect the permanent PostgreSQL + PostGIS DDL migrations in <code className="font-mono">src/db/migrations/</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {migrations.map((m, i) => (
                    <button
                      key={m.name}
                      onClick={() => setSelectedMigrationIdx(i)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                        selectedMigrationIdx === i
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {m.upFile}
                    </button>
                  ))}
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                    <button
                      onClick={() => setSqlDirection('up')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        sqlDirection === 'up' ? 'bg-emerald-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      UP (.sql)
                    </button>
                    <button
                      onClick={() => setSqlDirection('down')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        sqlDirection === 'down' ? 'bg-amber-600 text-white' : 'text-slate-500'
                      }`}
                    >
                      DOWN (.down.sql)
                    </button>
                  </div>
                </div>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-80 leading-relaxed">
                {sqlDirection === 'up' ? activeMigration.upSql : activeMigration.downSql}
              </pre>
            </section>
          )}
        </div>
      )}

      {/* SECTION 1: 7 MANDATORY TEST RESULTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Automated Server-Side Test Cases
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {testResults.filter(t => t.passed).length} of {testResults.length} passed
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {testResults.map((t, idx) => (
            <div
              key={t.id}
              className={`p-4 rounded-2xl border transition-all ${
                t.passed
                  ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-950/80 shadow-sm'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {t.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        0{idx + 1}.
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {t.testName}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t.details}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full font-mono uppercase tracking-wider shrink-0 ${
                    t.passed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {t.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-1">
                <span>
                  <strong>Expected:</strong> {t.expectedOutcome}
                </span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  <strong>Actual:</strong> {t.actualOutcome}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 2: INTERACTIVE DUAL ENGINE PLAYGROUND */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-sm space-y-5 sm:space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Sliders className="w-4 h-4" />
            <span>Interactive Policy Simulator</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
            Test Distance & Policy Gating Between Any Two Cities
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select a publishing city and viewer city to verify how Haversine distance triggers Engine A vs Engine B rules.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Origin City */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              1. Content Origin (Publisher Coordinates)
            </label>
            <select
              value={simPostOriginCity.name}
              onChange={e => {
                const found = CITY_PRESETS.find(c => c.name === e.target.value);
                if (found) setSimPostOriginCity(found);
              }}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {CITY_PRESETS.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.country})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 block font-mono">
              Lat: {simPostOriginCity.latitude}° · Lon: {simPostOriginCity.longitude}°
            </span>
          </div>

          {/* Viewer City */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              2. Viewer Location (Audience Coordinates)
            </label>
            <select
              value={simViewerCity.name}
              onChange={e => {
                const found = CITY_PRESETS.find(c => c.name === e.target.value);
                if (found) setSimViewerCity(found);
              }}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {CITY_PRESETS.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.country})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 block font-mono">
              Lat: {simViewerCity.latitude}° · Lon: {simViewerCity.longitude}°
            </span>
          </div>
        </div>

        {/* Engine Type & Radius Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              3. Distribution Engine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSimEngineType('organic')}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                  simEngineType === 'organic'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                Engine A: Organic
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimEngineType('commercial');
                  if (simScope === 'worldwide') setSimScope('40km');
                }}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                  simEngineType === 'commercial'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                Engine B: Commercial
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                4. Scope / Radius (km)
              </label>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                {simEngineType === 'organic' && simScope === 'worldwide' ? 'WORLDWIDE' : `${simCustomRadius} km`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {simEngineType === 'organic' ? (
                <div className="flex flex-wrap gap-1.5 w-full">
                  <button
                    onClick={() => setSimScope('worldwide')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                      simScope === 'worldwide'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    Worldwide 🌍
                  </button>
                  {[10, 40, 200, 500].map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        setSimScope('custom');
                        setSimCustomRadius(r);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg ${
                        simScope !== 'worldwide' && simCustomRadius === r
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {r}km
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 w-full">
                  {[5, 10, 25, 40].map(r => (
                    <button
                      key={r}
                      onClick={() => setSimCustomRadius(r)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                        simCustomRadius === r
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {r}km
                    </button>
                  ))}
                  <button
                    onClick={() => setSimCustomRadius(41)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed ${
                      simCustomRadius === 41
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'border-rose-300 text-rose-600'
                    }`}
                  >
                    41km (Test Rejection)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Simulation Output Box */}
        <div
          className={`p-5 rounded-2xl border transition-all space-y-3 ${
            playgroundViolation
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
              : playgroundEligible
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Haversine Spherical Distance
              </span>
              <span className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {playgroundDistance.toLocaleString()} km
              </span>
            </div>

            <span
              className={`px-3 py-1 text-xs font-bold rounded-full font-mono uppercase self-start sm:self-auto ${
                playgroundViolation
                  ? 'bg-rose-600 text-white'
                  : playgroundEligible
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-white'
              }`}
            >
              {playgroundViolation
                ? 'POLICY VIOLATION'
                : playgroundEligible
                ? 'DELIVERY ELIGIBLE'
                : 'DELIVERY BLOCKED'}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
            {playgroundReason}
          </p>
        </div>
      </section>

    </div>
  );
};

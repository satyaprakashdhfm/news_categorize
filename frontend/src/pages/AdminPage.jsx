import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, DOMAIN_COLORS, SUBCATEGORY_LABELS } from '@/utils/helpers';
import { feedCardsApi } from '@/services/api';
import {
  Loader2, LayoutGrid, RefreshCw, Globe2, EyeOff, Play, Shield,
} from 'lucide-react';
import { cn } from '@/utils/helpers';

const CARD_QUERIES = {
  // Policy & Governance
  EXE: 'global heads of state executive decisions government policy leadership elections major nations world leaders',
  LEG: 'global parliament legislation bills policy reforms legislative debates laws across major democracies',
  JUD: 'international court rulings landmark legal judgments human rights constitutional law global justice',
  GEO: 'geopolitical flashpoints global power shifts alliances rivalries international crises diplomacy world order',
  // Economy
  MAC: 'global GDP growth inflation recession central banks world economic outlook IMF World Bank fiscal policy',
  MIC: 'global consumer trends corporate competition pricing power market structure business economics worldwide',
  INV: 'global stock markets IPO venture capital private equity investment flows emerging markets capital',
  MON: 'global central banks interest rate decisions monetary tightening easing inflation currency forex',
  TRD: 'global trade wars tariffs supply chain disruptions WTO bilateral deals export import reshoring',
  // Business
  SCA: 'global startup ecosystem funding rounds unicorns IPO mergers acquisitions cross-border corporate deals',
  MID: 'global industry disruption market consolidation sector dynamics competitive landscape incumbent challengers',
  // Science & Technology
  SAI: 'global AI breakthroughs large language models open source frontier models regulation safety alignment',
  PHY: 'physics research breakthroughs quantum computing particle physics dark matter fusion energy labs worldwide',
  BIO: 'global biotech breakthroughs gene editing CRISPR drug approvals clinical trials pandemic preparedness',
  ROB: 'global robotics humanoid autonomous systems industrial automation AI hardware embodied intelligence',
  DEF: 'global defense technology military innovations drones hypersonic cyber warfare arms race procurement',
  SPC: 'global space race rocket launches satellite constellations moon base Mars missions commercial space',
  NMI: 'nanotechnology advanced materials graphene 2D materials metamaterials manufacturing breakthroughs',
  EHW: 'global semiconductor supply TSMC chip war GPU AI hardware electronics consumer devices innovation',
};

export default function AdminPage() {
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const adminRes = await fetch('/api/feed-cards/admin/all?limit=200');
      const adminData = await adminRes.json();
      setCards(adminData.cards || []);
    } catch {
      setError('Failed to load cards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSeed = async () => {
    setSeeding(true); setSeedResult(null); setError('');
    try {
      const res = await fetch('/api/feed-cards/admin/seed-domains', { method: 'POST' });
      const data = await res.json();
      setSeedResult(data);
      load();
    } catch {
      setError('Seeding failed.');
    } finally {
      setSeeding(false);
    }
  };

  const toggleGlobal = async (card) => {
    setTogglingId(card.id);
    try {
      await feedCardsApi.setGlobal(card.id, !card.is_global);
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_global: !c.is_global } : c));
    } catch {
      setError('Failed to update card.');
    } finally {
      setTogglingId(null);
    }
  };

  const runResearch = (card) => {
    const query = CARD_QUERIES[card.subdomain] || `${card.title} latest developments`;
    navigate(
      `/custom/browser?q=${encodeURIComponent(query)}&domain=${card.domain}&subdomain=${card.subdomain}&autorun=1`
    );
  };

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cards.filter(c => c.domain === cat.id && c.type === 'domain');
    return acc;
  }, {});
  const customCards = cards.filter(c => c.type === 'custom');

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Standalone admin header — no user auth, no app nav */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
        <Shield className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <span className="text-white font-bold text-lg">Curio Admin</span>
        <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">Internal</span>
        <a href="/" className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors">← Back to app</a>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-5 text-gray-100">

          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Domain Cards</h1>
              <p className="text-sm text-secondary-500 dark:text-gray-400 mt-0.5">
                Seed the 19 predefined cards and run browser research for each one.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={load} title="Refresh" className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-gray-700 transition-colors">
                <RefreshCw className={cn('h-4 w-4 text-secondary-400', loading && 'animate-spin')} />
              </button>
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
              >
                <LayoutGrid className="h-4 w-4" />
                {seeding ? 'Seeding...' : 'Seed All Domain Cards'}
              </button>
            </div>
          </div>

          {seedResult && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
              ✓ Created <strong>{seedResult.created}</strong> new cards · {seedResult.skipped} already existed
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Cards by domain */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {CATEGORIES.map(cat => {
                const domCards = grouped[cat.id] || [];
                if (!domCards.length) return null;
                const colors = DOMAIN_COLORS[cat.id];
                return (
                  <div key={cat.id} className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                    <div className={cn('px-5 py-3 flex items-center gap-2', colors.bg)}>
                      <span className="text-lg">{cat.icon}</span>
                      <span className={cn('font-bold text-sm', colors.text)}>{cat.name}</span>
                      <span className={cn('ml-auto text-xs font-medium', colors.text)}>{domCards.length} cards</span>
                    </div>
                    <div className="divide-y divide-gray-700">
                      {domCards.map(card => (
                        <div key={card.id} className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-100">{card.title}</span>
                            <span className="ml-2 text-xs text-gray-500 font-mono">{card.subdomain}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Run Research */}
                            <button
                              onClick={() => runResearch(card)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-all"
                              title="Run browser research for this topic"
                            >
                              <Play className="h-3.5 w-3.5" /> Run Research
                            </button>
                            {/* Toggle global */}
                            <button
                              onClick={() => toggleGlobal(card)}
                              disabled={togglingId === card.id}
                              title={card.is_global ? 'Visible in Global Feed — click to hide' : 'Hidden — click to show'}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                card.is_global
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
                                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                              )}
                            >
                              {togglingId === card.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : card.is_global
                                  ? <><Globe2 className="h-3.5 w-3.5" /> Global</>
                                  : <><EyeOff className="h-3.5 w-3.5" /> Hidden</>}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {customCards.length > 0 && (
                <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="px-5 py-3 bg-secondary-50 dark:bg-gray-700/50 flex items-center gap-2">
                    <span className="font-bold text-sm text-secondary-700 dark:text-gray-300">Custom Cards ({customCards.length})</span>
                  </div>
                  <div className="divide-y divide-gray-700">
                    {customCards.map(card => (
                      <div key={card.id} className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-gray-100">{card.title}</span>
                          {card.domain && (
                            <span className={cn('ml-2 px-1.5 py-0.5 rounded text-xs font-semibold', DOMAIN_COLORS[card.domain]?.bg, DOMAIN_COLORS[card.domain]?.text)}>
                              {card.domain}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => toggleGlobal(card)}
                          disabled={togglingId === card.id}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0',
                            card.is_global
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          )}
                        >
                          {togglingId === card.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : card.is_global
                              ? <><Globe2 className="h-3.5 w-3.5" /> Global</>
                              : <><EyeOff className="h-3.5 w-3.5" /> Hidden</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loading && cards.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">
                  No cards yet. Click <strong>Seed All Domain Cards</strong> to create the 19 predefined cards.
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

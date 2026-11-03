import React, { useState } from 'react';
import { AdCampaign, BusinessProfile } from '../types/index.ts';
import { useLocation } from '../context/LocationContext.tsx';
import {
  Briefcase,
  Sliders,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  DollarSign,
  Users,
  MousePointerClick,
  Eye
} from 'lucide-react';

interface BusinessAdHubProps {
  campaigns: AdCampaign[];
  businesses: BusinessProfile[];
  onRefreshData: () => void;
}

export const BusinessAdHub: React.FC<BusinessAdHubProps> = ({
  campaigns,
  businesses,
  onRefreshData
}) => {
  const { viewerLocation } = useLocation();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'create_campaign' | 'register_business'>('campaigns');

  const [campaignName, setCampaignName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [businessId, setBusinessId] = useState(businesses[0]?.id || '');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(25);
  const [budgetTotal, setBudgetTotal] = useState<number>(3000);
  const [budgetModel, setBudgetModel] = useState<'CPM' | 'CPC'>('CPM');
  const [ctaType, setCtaType] = useState<'VISIT_STORE' | 'ORDER_ONLINE' | 'BOOK_NOW'>('VISIT_STORE');
  const [ctaUrl, setCtaUrl] = useState('https://localnet.example.com');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [bizName, setBizName] = useState('');
  const [bizCategory, setBizCategory] = useState('Restaurant & Dining');
  const [bizAddress, setBizAddress] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizDescription, setBizDescription] = useState('');
  const [bizSuccess, setBizSuccess] = useState(false);

  const totalImpressions = campaigns.reduce((acc, c) => acc + c.metrics.impressions, 0);
  const totalEligibleViewers = campaigns.reduce((acc, c) => acc + c.metrics.eligibleViewersReached, 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + c.metrics.clicks, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.budget.spent, 0);
  const averageCtr =
    totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          campaignName,
          headline,
          bodyText,
          callToAction: ctaType,
          ctaUrl,
          targetCoordinates: viewerLocation.coords,
          targetCity: viewerLocation.cityName,
          selectedRadiusKm,
          budgetTotal,
          currency: 'INR',
          model: budgetModel
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error || 'Failed to create campaign. Server rejected distribution parameters.');
      } else {
        setSubmitSuccess(`Campaign "${campaignName}" validated and approved! Hyperlocal distribution active within ${selectedRadiusKm} km.`);
        onRefreshData();
        setCampaignName('');
        setHeadline('');
        setBodyText('');
        setTimeout(() => {
          setActiveTab('campaigns');
        }, 1500);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error submitting campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/businesses/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bizName,
          category: bizCategory,
          address: bizAddress,
          city: viewerLocation.cityName,
          state: viewerLocation.stateName,
          phone: bizPhone,
          description: bizDescription,
          coordinates: viewerLocation.coords
        })
      });
      if (response.ok) {
        setBizSuccess(true);
        onRefreshData();
        setBizName('');
        setBizAddress('');
        setBizPhone('');
        setBizDescription('');
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6 space-y-5 sm:space-y-8">
      
      {/* Top Banner & Sub-Navigation */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Hyperlocal Commerce Engine B</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            Local Business Advertising Platform
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            All commercial advertisements are strictly bounded to a verified maximum geographical radius of 40 km.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar w-full md:w-auto shrink-0">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'campaigns'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Campaigns ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab('create_campaign')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'create_campaign'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            + New Campaign
          </button>
          <button
            onClick={() => setActiveTab('register_business')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'register_business'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Register Store
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm min-w-0">
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium truncate">
            <Eye className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">Impressions</span>
          </span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums truncate">
            {totalImpressions.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium truncate block">100% ≤ 40km</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm min-w-0">
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium truncate">
            <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Viewers</span>
          </span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums truncate">
            {totalEligibleViewers.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 font-medium truncate block">Verified devices</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm min-w-0">
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium truncate">
            <MousePointerClick className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Clicks</span>
          </span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums truncate">
            {totalClicks.toLocaleString()}
            <span className="text-xs font-normal text-slate-400 ml-1">({averageCtr}%)</span>
          </p>
          <span className="text-[10px] text-slate-400 font-medium truncate block">Local purchase intent</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm min-w-0">
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium truncate">
            <DollarSign className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">Spend</span>
          </span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums truncate">
            ₹{totalSpent.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 font-medium truncate block">CPM / CPC model</span>
        </div>
      </div>

      {/* TAB 1: CAMPAIGNS LIST */}
      {activeTab === 'campaigns' && (
        <div className="w-full space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Active Geotargeted Campaigns
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Server validated
            </span>
          </div>

          <div className="w-full space-y-3 sm:space-y-4">
            {campaigns.map(camp => (
              <div
                key={camp.id}
                className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3 min-w-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                        {camp.campaignName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 shrink-0">
                        {camp.approvalStatus.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {camp.businessName} · {camp.businessCategory}
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 shrink-0 self-start sm:self-auto">
                    Radius: {camp.selectedRadiusKm}km (≤ 40km policy)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 text-[11px]">Copy:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {camp.headline}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                      {camp.bodyText}
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 text-[11px]">Budget & Model:</span>
                    <p className="font-mono text-slate-800 dark:text-slate-200 truncate">
                      Spent: ₹{camp.budget.spent.toLocaleString()} / ₹{camp.budget.total.toLocaleString()}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      Model: {camp.budget.model} (₹{camp.budget.costPerUnit} unit)
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 text-[11px]">Performance:</span>
                    <p className="text-slate-800 dark:text-slate-200 font-mono">
                      Impr: {camp.metrics.impressions.toLocaleString()}
                    </p>
                    <p className="text-slate-800 dark:text-slate-200 font-mono">
                      CTR: {camp.metrics.ctr}% ({camp.metrics.clicks} clicks)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE CAMPAIGN */}
      {activeTab === 'create_campaign' && (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-8 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              Configure Hyperlocal Campaign (≤ 40 km)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
              Distribution Engine B rule: Selected radius MUST be ≤ 40 km. Values above 40 km are rejected server-side.
            </p>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Server Validation Rejected Campaign:</p>
                <p className="mt-0.5 leading-relaxed">{submitError}</p>
              </div>
            </div>
          )}

          {submitSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Campaign Deployed:</p>
                <p className="mt-0.5 leading-relaxed">{submitSuccess}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Claypot Biryani Special"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Registered Store
                </label>
                <select
                  value={businessId}
                  onChange={e => setBusinessId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Headline
              </label>
              <input
                type="text"
                required
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                placeholder="e.g. Authentic Kurnool Dum Biryani"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Body Description & Offer
              </label>
              <textarea
                required
                rows={2}
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                placeholder="Describe the discount, store hours, or menu special..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* RADIUS SELECTION: STRICT 40 KM CAP */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Target Advertising Radius
                  </span>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    Engine B enforces maximum 40 km limit.
                  </p>
                </div>

                <span className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                  {selectedRadiusKm} km
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 5, 10, 20, 30, 40].map(r => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setSelectedRadiusKm(r)}
                    className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                      selectedRadiusKm === r
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {r} km
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setSelectedRadiusKm(45)}
                  className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-xl border border-dashed transition-all ${
                    selectedRadiusKm === 45
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'border-rose-300 text-rose-600'
                  }`}
                  title="Test rejection above 40 km"
                >
                  45 km (Test Rejection)
                </button>
              </div>

              {selectedRadiusKm > 40 && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  Notice: 45 km exceeds the 40 km platform rule and will be rejected with HTTP 422.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Budget (INR)
                </label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={budgetTotal}
                  onChange={e => setBudgetTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Model
                </label>
                <select
                  value={budgetModel}
                  onChange={e => setBudgetModel(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="CPM">CPM (Per 1k Impr)</option>
                  <option value="CPC">CPC (Per Click)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CTA
                </label>
                <select
                  value={ctaType}
                  onChange={e => setCtaType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="VISIT_STORE">VISIT STORE</option>
                  <option value="ORDER_ONLINE">ORDER ONLINE</option>
                  <option value="BOOK_NOW">BOOK NOW</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('campaigns')}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm"
              >
                {isSubmitting ? 'Validating...' : 'Submit Campaign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: REGISTER STORE */}
      {activeTab === 'register_business' && (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-8 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Register Physical Store or Local Service
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Links your business coordinates in {viewerLocation.cityName} for verified 40 km advertising campaigns.
            </p>
          </div>

          {bizSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Business registered and verified! You can now create campaigns.</span>
            </div>
          )}

          <form onSubmit={handleRegisterBusiness} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={bizName}
                  onChange={e => setBizName(e.target.value)}
                  placeholder="e.g. Rayalaseema Spice Kitchen"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={bizCategory}
                  onChange={e => setBizCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Restaurant & Dining">Restaurant & Dining</option>
                  <option value="Retail & Handicrafts">Retail & Handicrafts</option>
                  <option value="Hospitals & Healthcare">Hospitals & Healthcare</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Supermarkets & Grocery">Supermarkets & Grocery</option>
                  <option value="Local Services">Local Services</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Street Address in {viewerLocation.cityName}
              </label>
              <input
                type="text"
                required
                value={bizAddress}
                onChange={e => setBizAddress(e.target.value)}
                placeholder="e.g. Near Old Bus Stand, Park Road"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                required
                value={bizPhone}
                onChange={e => setBizPhone(e.target.value)}
                placeholder="+91 8518 223344"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm"
              >
                Complete Registration
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

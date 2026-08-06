import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { ImagePlus, X, Loader2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { useLaunchToken, type LaunchFormValues } from '@/hooks/useLaunchToken';
import { activeNetwork, CONTRACTS, explorerAddress, explorerTx } from '@/config/networks';
import { shortAddress } from '@/lib/format';

const DURATIONS = [
  { label: '30 min', value: 30 * 60 },
  { label: '1 hour', value: 60 * 60 },
  { label: '6 hours', value: 6 * 60 * 60 },
  { label: '24 hours', value: 24 * 60 * 60 },
  { label: '2 days', value: 2 * 24 * 60 * 60 },
];

const initialForm: LaunchFormValues = {
  name: '',
  symbol: '',
  description: '',
  image: null,
  totalSupply: '100000000000',
  fairLaunchPercent: 40,
  fairLaunchDuration: 30 * 60,
  targetMarketCap: '10000',
  multiple: 2,
  creatorFeeAllocationPercent: 80,
  preminePercent: 0,
  startsInSeconds: 0,
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <span className="eyebrow">{label}</span>
        {hint && <span className="mono text-[10px] text-ink-mute">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

/** A numbered section header, like a spec sheet. */
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/12 pt-6">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="mono text-[10px] text-ink-mute">{n}</span>
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export default function LaunchToken() {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const { launch, step, error, result, reset, isBusy } = useLaunchToken();

  const [form, setForm] = useState<LaunchFormValues>(initialForm);
  const [preview, setPreview] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof LaunchFormValues>(key: K, value: LaunchFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickImage = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    set('image', file);
    setPreview(URL.createObjectURL(file));
  };

  const isPresetDuration = DURATIONS.some((d) => d.value === form.fairLaunchDuration);

  const onCustomDays = (raw: string) => {
    setCustomDays(raw);
    const days = Number(raw);
    if (raw !== '' && Number.isFinite(days) && days > 0) {
      set('fairLaunchDuration', Math.round(days * 24 * 60 * 60));
    }
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.symbol.trim()) e.symbol = 'Ticker is required';
    if (form.symbol.length > 12) e.symbol = 'Max 12 characters';
    if (!form.image) e.image = 'An image is required';
    if (Number(form.totalSupply) <= 0) e.totalSupply = 'Total supply must be > 0';
    if (form.fairLaunchPercent <= 0 || form.fairLaunchPercent > 100)
      e.fairLaunchPercent = 'Fair launch supply must be between 1 and 100%';
    if (form.fairLaunchDuration <= 0) e.fairLaunchDuration = 'Pick a fair launch duration';
    if (Number(form.targetMarketCap) <= 0) e.targetMarketCap = 'Target market cap must be > 0';
    if (form.preminePercent < 0 || form.preminePercent >= form.fairLaunchPercent)
      e.preminePercent = 'Premine must be less than the fair launch supply';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return open();
    if (!valid || isBusy) return;
    await launch(form);
  };

  const stepLabel =
    step === 'uploading'
      ? 'Uploading to IPFS…'
      : step === 'signing'
        ? 'Confirm in your wallet…'
        : step === 'confirming'
          ? 'Waiting for confirmation…'
          : 'Launch token';

  /* ------------------------------------------------------ success ---- */
  if (step === 'done' && result) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-32 pb-24">
        <div className="card">
          <div className="hatch border-b border-ink/12 px-8 py-8 text-center">
            <div className="w-12 h-12 mx-auto bg-ink flex items-center justify-center mb-5">
              <Check size={24} className="text-gem-300" strokeWidth={3} />
            </div>
            <span className="eyebrow">Launch confirmed</span>
            <h2 className="display text-[34px] mt-3">{form.symbol.toUpperCase()} is live</h2>
            <p className="text-ink-soft text-[14px] mt-3 max-w-[40ch] mx-auto">
              Your fair launch has started. The subgraph will index it in a few blocks.
            </p>
          </div>

          <div className="divide-y divide-ink/8">
            {[
              ['Token', result.memecoin, explorerAddress(result.memecoin)],
              ['Transaction', result.txHash, explorerTx(result.txHash)],
            ].map(([label, value, href]) => (
              <div key={label} className="flex items-center justify-between px-6 py-3.5">
                <span className="eyebrow">{label}</span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono text-[12px] text-ink hover:text-gem-700 flex items-center gap-1.5"
                >
                  {shortAddress(value, 6)}
                  <ExternalLink size={11} />
                </a>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-px bg-ink/12 border-t border-ink/12">
            <Link
              to={`/token/${result.memecoin}`}
              className="btn btn-primary py-3.5 !border-0 text-[14px]"
            >
              View token page
            </Link>
            <button
              onClick={() => {
                reset();
                setForm(initialForm);
                setPreview(null);
                setCustomDays('');
              }}
              className="btn btn-soft py-3.5 !border-0 text-[14px]"
            >
              Launch another
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------- form ---- */
  return (
    <div className="pt-[58px]">
      <div className="border-b border-ink/12 bg-white">
        <div className="max-w-[820px] mx-auto px-4 md:px-6 py-10">
          <span className="eyebrow">New launch · {activeNetwork.label}</span>
          <h1 className="display text-[38px] md:text-[52px] mt-4">Launch your memecoin</h1>
          <p className="text-ink-soft text-[15px] mt-4 max-w-[50ch] leading-relaxed">
            Bonding-curve fair launch, automatic bid wall and perpetual creator fees. No liquidity
            needed — you only pay gas.
          </p>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-4 md:px-6 py-8">
        <form onSubmit={submit} className="card p-6 md:p-8 space-y-6">
          {/* -------------------------------------------------- identity */}
          <section>
            <div className="flex items-baseline gap-3 mb-5">
              <span className="mono text-[10px] text-ink-mute">01</span>
              <h2 className="text-[15px] font-bold tracking-tight">Identity</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              <div className="shrink-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                />
                {preview ? (
                  <div className="relative w-28 h-28 border border-ink">
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        set('image', null);
                        setPreview(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="absolute top-0 right-0 w-6 h-6 bg-ink text-gem-50 flex items-center justify-center hover:bg-danger cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      onPickImage(e.dataTransfer.files?.[0]);
                    }}
                    className="w-28 h-28 border border-dashed border-ink/30 hatch flex flex-col items-center justify-center gap-1.5 text-ink-mute hover:text-ink hover:border-ink transition-colors cursor-pointer"
                  >
                    <ImagePlus size={20} />
                    <span className="mono text-[10px] uppercase tracking-[0.14em]">Image</span>
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-5">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Gem Fot"
                    maxLength={40}
                    className="input-field w-full h-11 px-3.5 text-[15px]"
                  />
                </Field>
                <Field label="Ticker" hint={`${form.symbol.length}/12`}>
                  <input
                    value={form.symbol}
                    onChange={(e) => set('symbol', e.target.value.toUpperCase())}
                    placeholder="GEM"
                    maxLength={12}
                    className="input-field mono w-full h-11 px-3.5 text-[15px] uppercase tracking-[0.08em]"
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------- supply */}
          <Section n="02" title="Supply">
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Total supply" hint="tokens">
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={form.totalSupply}
                  onChange={(e) => set('totalSupply', e.target.value)}
                  className="input-field num w-full h-11 px-3.5 text-[15px]"
                />
              </Field>

              <Field label="Fair launch supply" hint="% of total">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.fairLaunchPercent}
                    onChange={(e) => set('fairLaunchPercent', Number(e.target.value))}
                    className="input-field num w-full h-11 pl-3.5 pr-9 text-[15px]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 mono text-[12px] text-ink-mute">
                    %
                  </span>
                </div>
              </Field>
            </div>

            <Field label="Premine" hint="% of total supply, optional">
              <input
                type="number"
                min={0}
                max={100}
                value={form.preminePercent}
                onChange={(e) => set('preminePercent', Number(e.target.value))}
                className="input-field num w-full h-11 px-3.5 text-[15px]"
              />
            </Field>
          </Section>

          {/* ------------------------------------------------ the curve */}
          <Section n="03" title="The curve">
            <Field label="Fair launch duration">
              <div className="seg w-full h-10 mb-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => {
                      set('fairLaunchDuration', d.value);
                      setCustomDays('');
                    }}
                    data-active={form.fairLaunchDuration === d.value}
                    className="flex-1"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={customDays}
                  onChange={(e) => onCustomDays(e.target.value)}
                  placeholder="Custom duration in days"
                  className={`input-field num w-full h-11 pl-3.5 pr-14 text-[15px] ${
                    !isPresetDuration && customDays ? 'border-ink' : ''
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 mono text-[11px] text-ink-mute">
                  days
                </span>
              </div>
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Target market cap" hint={CONTRACTS.nativeTokenSymbol}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.targetMarketCap}
                  onChange={(e) => set('targetMarketCap', e.target.value)}
                  className="input-field num w-full h-11 px-3.5 text-[15px]"
                />
              </Field>
              <Field label="Curve multiple" hint="end price multiplier">
                <input
                  type="number"
                  min={1}
                  value={form.multiple}
                  onChange={(e) => set('multiple', Number(e.target.value))}
                  className="input-field num w-full h-11 px-3.5 text-[15px]"
                />
              </Field>
            </div>
          </Section>

          {/* --------------------------------------------------- payout */}
          <Section n="04" title="Payout">
            <Field label="Creator fee share" hint="% of swap fees routed to you">
              <input
                type="number"
                min={0}
                max={100}
                value={form.creatorFeeAllocationPercent}
                onChange={(e) => set('creatorFeeAllocationPercent', Number(e.target.value))}
                className="input-field num w-full h-11 px-3.5 text-[15px]"
              />
            </Field>
          </Section>

          {/* --------------------------------------------------- submit */}
          <div className="border-t border-ink/12 pt-6 space-y-3">
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 border border-danger/40 bg-danger/[0.05]">
                <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
                <p className="mono text-[11px] text-danger leading-relaxed break-words">{error}</p>
              </div>
            )}

            {!valid && Object.keys(errors).length > 0 && (
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                {Object.values(errors)[0]}
              </p>
            )}

            <button
              type="submit"
              disabled={isBusy || (isConnected && !valid)}
              className="btn btn-primary w-full py-4 text-[15px]"
            >
              {isBusy && <Loader2 size={16} className="animate-spin" />}
              {isConnected ? stepLabel : 'Connect wallet to launch'}
            </button>

            <p className="mono text-[10px] uppercase tracking-[0.14em] text-ink-mute text-center">
              Launching is free — you only pay gas on {activeNetwork.label}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

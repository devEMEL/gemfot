import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { ImagePlus, X, Loader2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { useLaunchToken, type LaunchFormValues } from '@/hooks/useLaunchToken';
import { activeNetwork, CONTRACTS, explorerAddress, explorerTx } from '@/config/networks';
import { shortAddress } from '@/lib/format';

const DURATION_UNITS = [
  { key: 'days', label: 'D', seconds: 24 * 60 * 60 },
  { key: 'hours', label: 'H', seconds: 60 * 60 },
  { key: 'minutes', label: 'M', seconds: 60 },
  { key: 'seconds', label: 'S', seconds: 1 },
] as const;

type DurationBoxes = Record<(typeof DURATION_UNITS)[number]['key'], string>;

function splitDuration(totalSeconds: number): DurationBoxes {
  let rest = Math.max(0, Math.floor(totalSeconds));
  const boxes = {} as DurationBoxes;
  for (const unit of DURATION_UNITS) {
    boxes[unit.key] = String(Math.floor(rest / unit.seconds) || '');
    rest %= unit.seconds;
  }
  return boxes;
}

function durationToSeconds(boxes: DurationBoxes): number {
  return DURATION_UNITS.reduce(
    (acc, unit) => acc + (Number(boxes[unit.key]) || 0) * unit.seconds,
    0
  );
}

const PRESET_MULTIPLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
  creatorFeeAllocationPercent: 70,
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

/**
 * Days / hours / minutes / seconds boxes. The creator fills whichever box(es)
 * they want and the total is converted to seconds.
 */
function DurationField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (totalSeconds: number) => void;
}) {
  const [boxes, setBoxes] = useState<DurationBoxes>(() => splitDuration(value));
  const lastValue = useRef(value);

  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    setBoxes(splitDuration(value));
  }, [value]);

  const onBox = (key: keyof DurationBoxes, raw: string) => {
    const clean = raw.replace(/[^0-9]/g, '').slice(0, 4);
    const next = { ...boxes, [key]: clean };
    setBoxes(next);
    const total = durationToSeconds(next);
    lastValue.current = total;
    onChange(total);
  };

  return (
    <Field label={label} hint={hint}>
      <div className="grid grid-cols-4 gap-2">
        {DURATION_UNITS.map((unit) => (
          <div key={unit.key} className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={boxes[unit.key]}
              onChange={(e) => onBox(unit.key, e.target.value)}
              placeholder="0"
              className="input-field num w-full h-11 pl-3.5 pr-8 text-[15px]"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 mono text-[11px] text-ink-mute uppercase">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </Field>
  );
}

export default function LaunchToken() {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const { launch, step, error, result, reset, isBusy } = useLaunchToken();

  const [form, setForm] = useState<LaunchFormValues>(initialForm);
  const [preview, setPreview] = useState<string | null>(null);
  const [customMultiple, setCustomMultiple] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof LaunchFormValues>(key: K, value: LaunchFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickImage = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    set('image', file);
    setPreview(URL.createObjectURL(file));
  };

  const onCustomMultipleChange = (raw: string) => {
    setCustomMultiple(raw);
    const val = Number(raw);
    if (raw !== '' && Number.isFinite(val)) {
      set('multiple', val);
    }
  };

  const formatDuration = (seconds: number) => {
    const d = Math.floor(seconds / (24 * 60 * 60));
    const h = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const m = Math.floor((seconds % (60 * 60)) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
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
    if (form.multiple < 1 || form.multiple > 20)
      e.multiple = 'Multiple must be between 1x and 20x';
    if (form.creatorFeeAllocationPercent < 0 || form.creatorFeeAllocationPercent > 70)
      e.creatorFeeAllocationPercent = 'Creator fee allocation must be between 0% and 70%';
    if (form.preminePercent < 0 || form.preminePercent > 100)
      e.preminePercent = 'Premine must be between 0% and 100% of fair launch supply';
    return e;
  }, [form]);

  const expectedRaise = useMemo(() => {
    const mcap = Number(form.targetMarketCap);
    const multiple = Number(form.multiple);
    if (!Number.isFinite(mcap) || mcap <= 0 || !Number.isFinite(multiple) || multiple <= 0)
      return null;
    return (mcap * (multiple + 1)) / (2 * multiple);
  }, [form.targetMarketCap, form.multiple]);

  const valid = Object.keys(errors).length === 0;

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return open();
    if (!valid || isBusy) return;
    setShowConfirmModal(true);
  };

  const handleConfirmLaunch = async () => {
    setShowConfirmModal(false);
    await launch(form);
  };

  const stepLabel =
    step === 'uploading'
      ? 'Uploading to IPFS…'
      : step === 'approving'
        ? 'Approving 10 USDC launch fee…'
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
                setCustomMultiple('');
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
            Bonding-curve fair launch, automatic bid wall and creator fees. Launch fee is 10 USDC.
          </p>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-4 md:px-6 py-8">
        <form onSubmit={handleInitialSubmit} className="card p-6 md:p-8 space-y-6">
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
                  type="text"
                  inputMode="decimal"
                  value={form.totalSupply}
                  onChange={(e) => set('totalSupply', e.target.value.replace(/[^0-9.]/g, ''))}
                  className="input-field num w-full h-11 px-3.5 text-[15px]"
                />
              </Field>

              <Field label="Fair launch supply" hint="% of total">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.fairLaunchPercent}
                    onChange={(e) => set('fairLaunchPercent', Number(e.target.value.replace(/[^0-9.]/g, '')))}
                    className="input-field num w-full h-11 pl-3.5 pr-9 text-[15px]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 mono text-[12px] text-ink-mute">
                    %
                  </span>
                </div>
              </Field>
            </div>

            <Field label="Premine" hint="% of fair launch supply, optional">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.preminePercent}
                  onChange={(e) => set('preminePercent', Number(e.target.value.replace(/[^0-9.]/g, '')))}
                  className="input-field num w-full h-11 pl-3.5 pr-9 text-[15px]"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 mono text-[12px] text-ink-mute">
                  %
                </span>
              </div>
            </Field>
          </Section>

          {/* ------------------------------------------------ the curve */}
          <Section n="03" title="The curve & timing">
            <DurationField
              label="Fair launch duration"
              hint="days / hours / minutes / seconds"
              value={form.fairLaunchDuration}
              onChange={(seconds) => set('fairLaunchDuration', seconds)}
            />

            <DurationField
              label="Launch delay"
              hint="0 = immediately"
              value={form.startsInSeconds}
              onChange={(seconds) => set('startsInSeconds', seconds)}
            />

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Target market cap" hint={CONTRACTS.nativeTokenSymbol}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.targetMarketCap}
                  onChange={(e) => set('targetMarketCap', e.target.value.replace(/[^0-9.]/g, ''))}
                  className="input-field num w-full h-11 px-3.5 text-[15px]"
                />
                <p className="mt-2 mono text-[11px] text-ink/70 flex items-baseline justify-between">
                  <span className="text-ink-mute">Expected raise</span>
                  <span className="font-semibold">
                    {expectedRaise !== null
                      ? `$${expectedRaise.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'}{' '}
                    <span className="text-ink-mute font-normal">{CONTRACTS.nativeTokenSymbol}</span>
                  </span>
                </p>
              </Field>

              <Field label="Curve multiple" hint="max 20x">
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_MULTIPLES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          set('multiple', m);
                          setCustomMultiple('');
                        }}
                        className={`h-9 rounded border mono text-[12px] font-semibold transition-all ${
                          form.multiple === m && !customMultiple
                            ? 'bg-ink text-gem-50 border-ink'
                            : 'bg-white/50 text-ink/70 border-ink/20 hover:border-ink/40'
                        }`}
                      >
                        {m}x
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customMultiple}
                      onChange={(e) => onCustomMultipleChange(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="Custom multiple (e.g. 15)"
                      className={`input-field num w-full h-10 pl-3.5 pr-8 text-[13px] ${
                        customMultiple ? 'border-ink' : ''
                      }`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 mono text-[11px] text-ink-mute">
                      x
                    </span>
                  </div>
                </div>
              </Field>
            </div>
          </Section>

          {/* --------------------------------------------------- payout */}
          <Section n="04" title="Payout">
            <Field label="Creator fee share" hint="max 70% of swap fees">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.creatorFeeAllocationPercent}
                  onChange={(e) => set('creatorFeeAllocationPercent', Number(e.target.value.replace(/[^0-9.]/g, '')))}
                  className="input-field num w-full h-11 pl-3.5 pr-9 text-[15px]"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 mono text-[12px] text-ink-mute">
                  %
                </span>
              </div>
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
              Launch fee is 10 USDC + gas on {activeNetwork.label}
            </p>
          </div>
        </form>
      </div>

      {/* ------------------------------------------- Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold">Review Token Launch Details</h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Token Name</span>
                <span className="font-semibold text-white">{form.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Ticker</span>
                <span className="font-semibold text-white">{form.symbol}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Total Supply</span>
                <span className="text-white">{Number(form.totalSupply).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Fair Launch Supply</span>
                <span className="text-white">{form.fairLaunchPercent}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Premine (% of Fairlaunch)</span>
                <span className="text-white">{form.preminePercent}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Fair Launch Duration</span>
                <span className="text-white">{formatDuration(form.fairLaunchDuration)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Launch Start (launchAt)</span>
                <span className="text-white">
                  {form.startsInSeconds > 0
                    ? `Starts in ${formatDuration(form.startsInSeconds)}`
                    : 'Immediately'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Target Market Cap</span>
                <span className="text-white">${Number(form.targetMarketCap).toLocaleString()} USDC</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Expected Raise</span>
                <span className="text-white">
                  {expectedRaise !== null
                    ? `$${expectedRaise.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : '—'}{' '}
                  USDC
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Curve Multiple</span>
                <span className="text-white">{form.multiple}x</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Creator Fee Share</span>
                <span className="text-white">{form.creatorFeeAllocationPercent}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5 text-primary">
                <span>Launch Fee</span>
                <span className="font-bold">10 USDC</span>
              </div>
            </div>

            <p className="text-xs text-white/50 leading-relaxed">
              By proceeding, you will approve GemFotManager to spend 10 USDC (if not already approved) and trigger the token deployment transaction.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 border border-white/20 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLaunch}
                className="flex-1 py-3 bg-primary text-black font-semibold rounded-xl text-sm hover:brightness-110 transition-all"
              >
                Confirm & Launch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

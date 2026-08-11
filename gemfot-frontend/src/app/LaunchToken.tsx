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
        <span className="text-[13px] font-bold text-black/70">{label}</span>
        {hint && <span className="text-[11px] font-medium text-black/35">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-6 border-t border-black/[0.06]">
      <h2 className="text-[15px] font-extrabold tracking-tight text-black mb-5">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

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
      <div className="grid grid-cols-4 gap-2.5">
        {DURATION_UNITS.map((unit) => (
          <div key={unit.key} className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={boxes[unit.key]}
              onChange={(e) => onBox(unit.key, e.target.value)}
              placeholder="0"
              className="input-field num w-full h-12 pl-3.5 pr-8 text-[15px]"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#f60aa8] uppercase">
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

  if (step === 'done' && result) {
    return (
      <div className="pt-[64px] min-h-screen">
        <div className="max-w-lg mx-auto px-4 py-16">
          <div className="bg-white rounded-[28px] p-8 shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06] text-center flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-[#f60aa8] flex items-center justify-center shadow-[0_4px_14px_rgba(246,10,168,0.3)]">
              <Check size={24} className="text-white" strokeWidth={3} />
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#f60aa8]">Launch confirmed</p>
              <h2 className="text-[28px] font-extrabold tracking-tight text-black mt-2">
                {form.symbol.toUpperCase()} is live
              </h2>
              <p className="text-black/50 text-[14px] mt-2 max-w-[40ch] leading-relaxed mx-auto">
                Your fair launch has started. The subgraph will index it in a few blocks.
              </p>
            </div>
            <div className="w-full border-t border-black/[0.06] pt-5 space-y-3">
              {[
                ['Token', result.memecoin, explorerAddress(result.memecoin)],
                ['Transaction', result.txHash, explorerTx(result.txHash)],
              ].map(([label, value, href]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-black/40">{label}</span>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-bold text-[#f60aa8] hover:text-[#d00890] flex items-center gap-1.5"
                  >
                    {shortAddress(value, 6)}
                    <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 w-full mt-2">
              <Link to={`/token/${result.memecoin}`} className="btn btn-primary h-12 text-[14px]">
                View token page
              </Link>
              <button
                onClick={() => {
                  reset();
                  setForm(initialForm);
                  setPreview(null);
                  setCustomMultiple('');
                }}
                className="btn btn-soft h-12 text-[14px]"
              >
                Launch another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[64px] min-h-screen">
      <div className="max-w-[720px] mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="text-center mb-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#f60aa8]">
            New launch · {activeNetwork.label}
          </p>
          <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-tight text-black mt-2">
            Launch your memecoin
          </h1>
          <p className="text-black/50 text-[15px] mt-3 max-w-[48ch] mx-auto leading-relaxed">
            Bonding-curve fair launch, automatic liquidity, and creator fees. Launch fee is 10 USDC.
          </p>
        </div>

        <form
          onSubmit={handleInitialSubmit}
          className="bg-white rounded-[28px] p-6 md:p-8 shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06] space-y-0"
        >
          {/* Identity */}
          <section className="pb-6">
            <h2 className="text-[15px] font-extrabold tracking-tight text-black mb-5">Identity</h2>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="shrink-0">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                />
                {preview ? (
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-md">
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        set('image', null);
                        setPreview(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-[rgba(246,10,168,0.12)] hover:text-[#f60aa8] transition-colors cursor-pointer shadow-sm"
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
                    className="w-28 h-28 rounded-2xl border-2 border-dashed border-black/10 bg-[#f4f5f7] flex flex-col items-center justify-center gap-2 text-black/40 hover:text-[#f60aa8] hover:border-[#f60aa8]/40 hover:bg-[#fdf2f8] transition-colors cursor-pointer"
                  >
                    <ImagePlus size={22} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Image</span>
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Gem Fot"
                    maxLength={40}
                    className="input-field w-full h-12 px-4 text-[15px]"
                  />
                </Field>
                <Field label="Ticker" hint={`${form.symbol.length}/12`}>
                  <input
                    value={form.symbol}
                    onChange={(e) => set('symbol', e.target.value.toUpperCase())}
                    placeholder="GEM"
                    maxLength={12}
                    className="input-field mono w-full h-12 px-4 text-[15px] uppercase tracking-[0.08em]"
                  />
                </Field>
              </div>
            </div>
          </section>

          <Section title="Supply">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Total supply" hint="tokens">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.totalSupply}
                  onChange={(e) => set('totalSupply', e.target.value.replace(/[^0-9.]/g, ''))}
                  className="input-field num w-full h-12 px-4 text-[15px]"
                />
              </Field>
              <Field label="Fair launch supply" hint="% of total">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.fairLaunchPercent}
                    onChange={(e) =>
                      set('fairLaunchPercent', Number(e.target.value.replace(/[^0-9.]/g, '')))
                    }
                    className="input-field num w-full h-12 pl-4 pr-10 text-[15px]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#f60aa8]">
                    %
                  </span>
                </div>
              </Field>
            </div>
          </Section>

          <Section title="The curve & timing">
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
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Target market cap" hint={CONTRACTS.nativeTokenSymbol}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.targetMarketCap}
                  onChange={(e) => set('targetMarketCap', e.target.value.replace(/[^0-9.]/g, ''))}
                  className="input-field num w-full h-12 px-4 text-[15px]"
                />
                <p className="mt-2 text-[12px] text-black/40 flex items-baseline justify-between">
                  <span>Expected raise</span>
                  <span className="font-bold text-[#f60aa8]">
                    {expectedRaise !== null
                      ? `$${expectedRaise.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'}{' '}
                    <span className="text-black/30 font-medium">{CONTRACTS.nativeTokenSymbol}</span>
                  </span>
                </p>
              </Field>
              <Field label="Curve multiple" hint="max 20x">
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_MULTIPLES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          set('multiple', m);
                          setCustomMultiple('');
                        }}
                        className={`h-10 rounded-full text-[12px] font-bold transition-all cursor-pointer ${
                          form.multiple === m && !customMultiple
                            ? 'bg-[#f60aa8] text-white shadow-[0_4px_12px_rgba(246,10,168,0.25)]'
                            : 'bg-[#f4f5f7] text-black/40 hover:text-black hover:bg-[#f4f5f7]'
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
                      onChange={(e) =>
                        onCustomMultipleChange(e.target.value.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="Custom multiple (e.g. 15)"
                      className={`input-field num w-full h-12 pl-4 pr-8 text-[14px] ${
                        customMultiple ? '!border-[#f60aa8]/50' : ''
                      }`}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#f60aa8]">
                      x
                    </span>
                  </div>
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Payout">
            <Field label="Creator fee share" hint="max 70% of swap fees">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.creatorFeeAllocationPercent}
                  onChange={(e) =>
                    set('creatorFeeAllocationPercent', Number(e.target.value.replace(/[^0-9.]/g, '')))
                  }
                  className="input-field num w-full h-12 pl-4 pr-10 text-[15px]"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#f60aa8]">
                  %
                </span>
              </div>
            </Field>
          </Section>

          <div className="pt-6 border-t border-black/[0.06] space-y-4">
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-600 leading-relaxed break-words">{error}</p>
              </div>
            )}

            {!valid && Object.keys(errors).length > 0 && (
              <p className="text-[12px] font-semibold text-black/40">{Object.values(errors)[0]}</p>
            )}

            <button
              type="submit"
              disabled={isBusy || (isConnected && !valid)}
              className="btn btn-primary w-full h-14 text-[15px]"
            >
              {isBusy && <Loader2 size={16} className="animate-spin" />}
              {isConnected ? stepLabel : 'Connect wallet to launch'}
            </button>

            <p className="text-[12px] font-medium text-black/35 text-center">
              Launch fee is 10 USDC + gas on {activeNetwork.label}
            </p>
          </div>
        </form>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
              <h3 className="text-[17px] font-extrabold text-black">Review launch</h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-black/30 hover:text-black hover:bg-black/[0.03] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1 text-[13px]">
              {[
                ['Token Name', form.name],
                ['Ticker', form.symbol],
                ['Total Supply', Number(form.totalSupply).toLocaleString()],
                ['Fair Launch Supply', `${form.fairLaunchPercent}%`],
                ['Fair Launch Duration', formatDuration(form.fairLaunchDuration)],
                [
                  'Launch Start',
                  form.startsInSeconds > 0
                    ? `Starts in ${formatDuration(form.startsInSeconds)}`
                    : 'Immediately',
                ],
                ['Target Market Cap', `$${Number(form.targetMarketCap).toLocaleString()} USDC`],
                [
                  'Expected Raise',
                  expectedRaise !== null
                    ? `$${expectedRaise.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
                    : '—',
                ],
                ['Curve Multiple', `${form.multiple}x`],
                ['Creator Fee Share', `${form.creatorFeeAllocationPercent}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between py-2.5 border-b border-black/[0.06]"
                >
                  <span className="text-black/40 font-medium">{label}</span>
                  <span className="font-bold text-black">{value}</span>
                </div>
              ))}
              <div className="flex justify-between py-2.5 text-[#f60aa8]">
                <span className="font-semibold">Launch Fee</span>
                <span className="font-extrabold">10 USDC</span>
              </div>
            </div>

            <p className="text-[12px] text-black/40 leading-relaxed">
              By proceeding, you will approve GemFotManager to spend 10 USDC and trigger token
              deployment.
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 btn btn-soft h-12 text-[14px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLaunch}
                className="flex-1 btn btn-primary h-12 text-[14px]"
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

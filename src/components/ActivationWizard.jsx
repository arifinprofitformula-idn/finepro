import { useMemo, useState } from 'react';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { ArrowRight, Building2, Check, CheckCircle2, ChevronDown, Landmark, Plus, Search, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { createOpeningWallet } from '../api/onboarding.js';
import { PROVIDER_CATEGORY_LABELS, quickWalletProviders, searchWalletProviders } from '../data/walletProviders.js';

function formatInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
}
function numberValue(value) {
  return Number(String(value || '').replace(/\D/g, '')) || 0;
}
function ProviderIcon({ category, size = 17 }) {
  if (category === 'bank') return <Landmark size={size} aria-hidden="true" />;
  if (category === 'ewallet') return <Wallet size={size} aria-hidden="true" />;
  if (category === 'custom') return <Plus size={size} aria-hidden="true" />;
  return <Wallet size={size} aria-hidden="true" />;
}

function ProviderCombobox({ selected, onSelect }) {
  const [query, setQuery] = useState('');
  const quick = useMemo(() => quickWalletProviders(), []);
  const results = useMemo(() => searchWalletProviders(query), [query]);
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of results) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    return groups;
  }, [results]);

  function choose(item) {
    if (!item) return;
    onSelect(item);
    setQuery(item.name);
  }

  return (
    <div>
      <label className="block text-xs font-bold text-neutral-600" htmlFor="activation-provider-search">Pilih bank atau dompet</label>
      <Combobox value={selected} onChange={choose} by="id" immediate>
        <div className="relative mt-1">
          <div className="flex h-12 items-center rounded-2xl border border-neutral-border bg-neutral-50 px-3 focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/15">
            <Search size={17} className="flex-shrink-0 text-neutral-400" aria-hidden="true" />
            <ComboboxInput
              id="activation-provider-search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Cari BCA, GoPay, Tunai..."
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-navy outline-none placeholder:font-medium placeholder:text-neutral-400"
              aria-label="Cari bank atau dompet"
            />
            <ChevronDown size={18} className="flex-shrink-0 text-neutral-400" aria-hidden="true" />
          </div>
          <ComboboxOptions
            transition
            className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-neutral-border bg-white p-2 shadow-[0_18px_48px_rgba(15,31,61,0.2)] outline-none transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            {[...grouped.entries()].map(([category, items]) => (
              <div key={category} className="not-last:mb-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">
                  {PROVIDER_CATEGORY_LABELS[category]}
                </div>
                {items.map((item) => (
                  <ComboboxOption
                    key={item.id}
                    value={item}
                    className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-neutral-700 outline-none data-[focus]:bg-violet-light data-[focus]:text-violet"
                  >
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${item.custom ? 'bg-mint-light text-mint' : 'bg-neutral-100 text-violet'}`}>
                      <ProviderIcon category={item.category} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {item.custom ? <>Tambahkan provider “{item.name}”</> : item.name}
                    </span>
                    <Check size={16} className="invisible text-violet group-data-[selected]:visible" aria-hidden="true" />
                  </ComboboxOption>
                ))}
              </div>
            ))}
          </ComboboxOptions>
        </div>
      </Combobox>

      <div className="mt-3">
        <div className="text-[10px] font-bold uppercase tracking-[.14em] text-neutral-400">Pilihan cepat</div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quick.map((item) => {
            const active = selected?.id === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => choose(item)}
                aria-pressed={active}
                className={`flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${active ? 'border-violet bg-violet text-white' : 'border-neutral-border bg-white text-neutral-600 hover:border-violet hover:text-violet'}`}
              >
                <ProviderIcon category={item.category} size={15} /> {item.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ActivationWizard({ status, onReady }) {
  const [step, setStep] = useState('welcome');
  const [provider, setProvider] = useState(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amount = useMemo(() => numberValue(balance), [balance]);

  if (!status?.activation_required || status.transaction_ready) return null;
  if (status.role !== 'owner') return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/65 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-[30px] bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-light text-violet"><ShieldCheck /></div>
        <h2 className="mt-4 text-xl font-bold text-navy">Menunggu pemilik household</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">Pemilik perlu membuat dompet dan menetapkan saldo awal. Setelah selesai, kamu bisa mencatat transaksi bersama.</p>
        <button onClick={() => window.location.reload()} className="mt-5 h-12 w-full rounded-full bg-violet font-bold text-white">Cek Lagi</button>
      </div>
    </div>
  );

  function selectProvider(item) {
    const previousDefault = provider?.name || '';
    setProvider(item);
    setName((current) => !current.trim() || current.trim() === previousDefault ? item.name : current);
  }

  async function submit(event) {
    event.preventDefault();
    if (!provider || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const key = crypto.randomUUID();
      await createOpeningWallet({name:name.trim(),actual_balance:amount,idempotency_key:key});
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-navy/65 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[32px] bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-label="Pengaturan awal FinePro">
        {step === 'welcome' && <>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-light text-violet"><Sparkles /></div>
          <div className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-violet">Aktivasi 1 dari 2</div>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-navy">Siapkan titik awal keuanganmu</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-500">Sebelum transaksi pertama, buat satu dompet dan masukkan saldo nyata saat ini. FinePro akan memulai laporan dari angka yang akurat.</p>
          <div className="mt-5 grid gap-2">
            <div className="flex gap-3 rounded-2xl bg-neutral-50 p-3"><Wallet className="text-violet" size={20} /><div><b className="text-sm text-navy">Buat dompet pertama</b><p className="text-xs text-neutral-500">Tunai, rekening bank, atau e-wallet.</p></div></div>
            <div className="flex gap-3 rounded-2xl bg-neutral-50 p-3"><Landmark className="text-mint" size={20} /><div><b className="text-sm text-navy">Tetapkan saldo awal</b><p className="text-xs text-neutral-500">Bukan pemasukan atau pengeluaran.</p></div></div>
          </div>
          <button onClick={() => setStep('wallet')} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-violet font-bold text-white">Mulai Pengaturan <ArrowRight size={17} /></button>
        </>}

        {step === 'wallet' && <form onSubmit={submit}>
          <div className="text-xs font-bold uppercase tracking-[.18em] text-violet">Aktivasi 2 dari 2</div>
          <h2 className="mt-2 text-2xl font-bold text-navy">Dompet dan saldo awal</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">Pilih provider agar lebih cepat. Nama dompet tetap bisa kamu sesuaikan.</p>

          <div className="mt-5"><ProviderCombobox selected={provider} onSelect={selectProvider} /></div>

          <label className="mt-4 block text-xs font-bold text-neutral-600" htmlFor="activation-wallet-name">Nama dompet</label>
          <div className="mt-1 flex h-12 items-center rounded-2xl border border-neutral-border bg-neutral-50 px-3 focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/15">
            <Building2 size={17} className="flex-shrink-0 text-neutral-400" aria-hidden="true" />
            <input id="activation-wallet-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: BCA Gaji" className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-navy outline-none focus:outline-none" />
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-neutral-400">Boleh diubah, misalnya “BCA Operasional” atau “GoPay Harian”.</p>

          <label className="mt-3 block text-xs font-bold text-neutral-600" htmlFor="activation-opening-balance">Saldo aktual saat ini</label>
          <div className="mt-1 flex h-12 items-center rounded-2xl border border-neutral-border bg-neutral-50 px-4 focus-within:border-violet">
            <span className="font-bold text-neutral-500">Rp</span>
            <input id="activation-opening-balance" inputMode="numeric" value={balance} onChange={(event) => setBalance(formatInput(event.target.value))} placeholder="0" className="h-full min-w-0 flex-1 bg-transparent px-2 text-lg font-bold text-navy outline-none" />
          </div>
          <div className="mt-3 rounded-2xl bg-mint-light p-3 text-xs leading-5 text-mint"><b>Baseline aman:</b> saldo Rp0 tetap valid dan tidak dihitung sebagai pemasukan atau pengeluaran.</div>
          {error && <div className="mt-3 rounded-xl bg-coral-light p-3 text-xs font-semibold text-coral">{error}</div>}
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1.5fr]">
            <button type="button" onClick={() => setStep('welcome')} disabled={saving} className="h-12 rounded-full border border-neutral-border font-bold text-neutral-600 transition focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2">Kembali</button>
            <button type="submit" disabled={saving || !provider || !name.trim()} className="h-12 rounded-full bg-violet px-3 text-sm font-bold text-white disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-violet focus:ring-offset-2">{saving ? 'Menyiapkan...' : 'Tetapkan Saldo Awal'}</button>
          </div>
        </form>}

        {step === 'done' && <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-light text-mint"><CheckCircle2 size={30} /></div>
          <h2 className="mt-4 text-2xl font-bold text-navy">FinePro siap digunakan</h2>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center gap-2 text-neutral-600"><CheckCircle2 size={17} className="text-mint" /> Dompet “{name}” dibuat</div>
            <div className="flex items-center gap-2 text-neutral-600"><CheckCircle2 size={17} className="text-mint" /> Saldo awal Rp{new Intl.NumberFormat('id-ID').format(amount)} ditetapkan</div>
            <div className="flex items-center gap-2 text-neutral-600"><CheckCircle2 size={17} className="text-mint" /> Siap mengenal dashboard</div>
          </div>
          <button onClick={onReady} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-violet font-bold text-white">Lihat Panduan Dashboard <ArrowRight size={17} /></button>
        </>}
      </div>
    </div>
  );
}

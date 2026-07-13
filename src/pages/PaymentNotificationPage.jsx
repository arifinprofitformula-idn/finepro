import { ArrowRight, BellRing, CheckCircle2, Copy, Globe2, RefreshCw, ShieldCheck } from "lucide-react";

function BrandLogo() {
  return (
    <img
      src="/images/fine-pro-header.png"
      alt="Fine Pro"
      className="h-12 w-auto object-contain"
    />
  );
}

function endpointUrl(path) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function copyText(value) {
  navigator.clipboard?.writeText(value).catch(() => {});
}

function EndpointCard({ icon: Icon, title, desc, value, method = "POST", tone = "violet" }) {
  const toneClass = {
    violet: "bg-violet-light text-violet",
    mint: "bg-mint-light text-mint",
    gold: "bg-gold-light text-gold"
  }[tone];

  return (
    <section className="gloss-panel rounded-[28px] p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${toneClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-navy">{title}</h2>
            <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-neutral-500">{method}</span>
          </div>
          <p className="mt-1 text-sm font-medium leading-relaxed text-neutral-500">{desc}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-border/70 bg-white/75 p-3">
        <div className="mb-1 text-[11px] font-bold uppercase text-neutral-400">URL endpoint</div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-xl bg-neutral-100 px-3 py-2 text-xs font-bold text-navy">
            {value}
          </code>
          <button
            type="button"
            onClick={() => copyText(value)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet text-white"
            aria-label={`Salin ${title}`}
            title="Salin URL"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function PaymentNotificationPage() {
  const notificationUrl = endpointUrl("/api/payments/notification");
  const finishUrl = endpointUrl("/payment/finish");

  return (
    <div className="app-glow-bg min-h-screen px-5 py-8">
      <main className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center" aria-label="Fine Pro">
            <BrandLogo />
          </a>
          <a
            href="/"
            className="flex h-10 items-center gap-1.5 rounded-full bg-white/75 px-4 text-xs font-bold text-neutral-600 shadow-soft transition hover:text-violet"
          >
            <ArrowRight size={14} className="rotate-180" />
            Kembali
          </a>
        </div>

        <section className="gloss-panel rounded-[32px] p-6 md:p-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-light px-3 py-1 text-[11px] font-bold text-violet">
            <BellRing size={13} />
            Midtrans Notification URL
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-navy md:text-4xl">
            Payment Notification Fine Pro
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-neutral-600 md:text-base">
            Gunakan endpoint ini di dashboard Midtrans agar Fine Pro menerima notifikasi pembayaran sukses, pending,
            gagal, batal, atau kedaluwarsa secara otomatis. Endpoint ini diproses server-to-server dan diverifikasi
            menggunakan signature Midtrans.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/70 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-mint">
                <CheckCircle2 size={15} />
                Signature verified
              </div>
              <p className="mt-1 text-xs font-medium text-neutral-500">Payload ditolak jika signature tidak valid.</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-violet">
                <RefreshCw size={15} />
                Idempotent
              </div>
              <p className="mt-1 text-xs font-medium text-neutral-500">Notifikasi ganda tidak menggandakan subscription.</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gold">
                <ShieldCheck size={15} />
                Server only
              </div>
              <p className="mt-1 text-xs font-medium text-neutral-500">Tidak membutuhkan login user atau token browser.</p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4">
          <EndpointCard
            icon={BellRing}
            title="Payment Notification URL"
            desc="Tempel URL ini pada pengaturan Notification URL Midtrans."
            value={notificationUrl}
            tone="violet"
          />
          <EndpointCard
            icon={Globe2}
            title="Finish Redirect URL"
            desc="URL halaman yang dilihat user setelah menyelesaikan pembayaran."
            value={finishUrl}
            method="GET"
            tone="mint"
          />
        </div>

        <section className="mt-5 rounded-[28px] border border-white/75 bg-white/65 p-5">
          <h2 className="text-base font-bold text-navy">Cara isi di Midtrans</h2>
          <div className="mt-3 grid gap-2 text-sm font-medium leading-relaxed text-neutral-600">
            <p>1. Buka Midtrans Dashboard, lalu masuk ke Payment Settings.</p>
            <p>2. Pada Notification URL, isi dengan Payment Notification URL di atas.</p>
            <p>3. Pada Finish Redirect URL, isi dengan Finish Redirect URL di atas.</p>
            <p>4. Recurring payment dan account linking boleh dikosongkan selama Fine Pro belum memakai fitur recurring atau GoPay account linking.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

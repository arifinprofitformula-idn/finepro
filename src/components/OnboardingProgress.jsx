const STEPS = ["Akun", "Kebutuhan", "Paket", "Bayar", "Siap"];

export default function OnboardingProgress({ current }) {
  const active = Math.max(1, Math.min(Number(current) || 1, STEPS.length));
  return (
    <div className="mb-5" aria-label={`Langkah ${active} dari ${STEPS.length}`}>
      <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-neutral-500">
        <span>Langkah {active} dari {STEPS.length}</span>
        <span>{STEPS[active - 1]}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
        {STEPS.map((step, index) => (
          <div key={step} className={`h-1.5 rounded-full ${index < active ? "bg-violet" : "bg-neutral-200"}`} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] font-semibold text-neutral-400">
        {STEPS.map((step, index) => <span key={step} className={index + 1 === active ? "text-violet" : ""}>{step}</span>)}
      </div>
    </div>
  );
}

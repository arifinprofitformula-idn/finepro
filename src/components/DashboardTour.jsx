import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';

const STEPS=[
 {selector:'[data-tour="financial-summary"]',title:'Ringkasan keuangan',text:'Pantau pemasukan, pengeluaran, dan saldo dari seluruh aktivitas household.',page:'dashboard'},
 {selector:'[data-tour="wallet-card"]',title:'Dompet utama',text:'Saldo terbaru dari dompet utama. Klik untuk lihat detail atau kalibrasi.',page:'dashboard'},
 {selector:'[data-tour="history-export"]',title:'Riwayat dan draft',text:'Lihat transaksi lama, koreksi draft WhatsApp/Telegram, atau ekspor ke CSV.',page:'history'},
 {selector:'[data-tour="history-filter"]',title:'Filter periode',text:'Pilih bulan atau tahun tertentu. Klik kalender untuk pilih tanggal.',page:'history'},
 {selector:'[data-tour="setting-nav"]',title:'Pengaturan lengkap',text:'Kelola dompet, kalibrasi saldo, kategori, notifikasi, WhatsApp, dan Telegram.',page:'setting'},
];

export default function DashboardTour({open,onClose,onNavigate}){
 const [index,setIndex]=useState(0);const [rect,setRect]=useState(null);const step=STEPS[index];
 useEffect(()=>{
  if(!open)return;onNavigate(step.page);
  const timer=setTimeout(()=>{
   const el=document.querySelector(step.selector);
   if(!el){setRect(null);return;}
   el.scrollIntoView({behavior:'smooth',block:'center'});
   setTimeout(()=>setRect(el.getBoundingClientRect()),200);
  },80);
  const update=()=>{const el=document.querySelector(step.selector);if(el)setRect(el.getBoundingClientRect());};
  window.addEventListener('resize',update);
  return()=>{clearTimeout(timer);window.removeEventListener('resize',update);};
 },[open,index,step,onNavigate]);
 const line=useMemo(()=>{if(!rect)return null;return{x:rect.left+rect.width/2,y:Math.min(window.innerHeight-200,rect.bottom+20)};},[rect]);
 if(!open)return null;
 const finish=()=>{setIndex(0);onClose();};
 return <div className="fixed inset-0 z-50 pointer-events-none" role="dialog" aria-modal="true" aria-label="Panduan dashboard FinePro">
  <svg className="pointer-events-none absolute inset-0 h-full w-full"><defs><mask id="finepro-tour-mask"><rect width="100%" height="100%" fill="white"/>{rect&&<rect x={rect.left-10} y={rect.top-10} width={rect.width+20} height={rect.height+20} rx="24" fill="black"/>}</mask></defs>
   <rect width="100%" height="100%" fill="rgba(15,31,61,.72)" mask="url(#finepro-tour-mask)"/>
   {rect&&<rect x={rect.left-10} y={rect.top-10} width={rect.width+20} height={rect.height+20} rx="24" fill="none" stroke="#a99af8" strokeWidth="3"/>}
   {line&&<line x1={line.x} y1={rect.bottom+10} x2={window.innerWidth/2} y2={Math.min(window.innerHeight-70,line.y+50)} stroke="#a99af8" strokeWidth="2" strokeDasharray="5 5"/>}
  </svg>
  <div className="absolute bottom-0 left-4 right-4 mx-auto max-w-md max-h-[calc(100dvh-70px)] overflow-y-auto rounded-t-[28px] rounded-b-[12px] bg-white p-5 pb-[env(safe-area-inset-bottom)] shadow-2xl pointer-events-auto">
   <div className="flex items-start justify-between">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-violet"><Sparkles size={15}/> Panduan {index+1} dari {STEPS.length}</div>
    <button onClick={finish} aria-label="Tutup panduan" className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"><X size={16}/></button>
   </div>
   <h2 className="mt-3 text-xl font-bold text-navy">{step.title}</h2>
   <p className="mt-2 text-sm leading-6 text-neutral-500 break-words">{step.text}</p>
   <div className="mt-5 flex items-center gap-2">
    <button disabled={index===0} onClick={()=>setIndex(i=>i-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-border text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowLeft size={18}/></button>
    <div className="flex flex-1 justify-center gap-1.5">
     {STEPS.map((_,i)=><span key={i} className={`h-2 rounded-full transition-all ${i===index?'w-6 bg-violet':'w-2 bg-neutral-200'}`}/>)}
    </div>
    {index===STEPS.length-1?<button onClick={finish} className="flex h-11 items-center gap-2 rounded-full bg-mint px-5 text-sm font-bold text-white"><CheckCircle2 size={17}/> Selesai</button>:<button onClick={()=>setIndex(i=>i+1)} className="flex h-11 items-center gap-2 rounded-full bg-violet px-5 text-sm font-bold text-white">Lanjut <ArrowRight size={17}/></button>}
   </div>
  </div>
 </div>;
}

export function getTourSelectors(){
 return {
  financialSummary:'[data-tour="financial-summary"]',
  walletCard:'[data-tour="wallet-card"]',
  transactionInput:'[data-tour="transaction-input"]',
  historyNav:'[data-tour="history-nav"]',
  historyExport:'[data-tour="history-export"]',
  historyFilter:'[data-tour="history-filter"]',
  settingNav:'[data-tour="setting-nav"]',
 };
}
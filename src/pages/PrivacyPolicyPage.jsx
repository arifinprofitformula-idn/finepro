import { ArrowRight, FileText, Mail, ShieldCheck } from "lucide-react";

const EFFECTIVE_DATE = "13 Juli 2026";
const UPDATED_DATE = "18 Juli 2026";
const CONTACT_EMAIL = "contact.bustanul@gmail.com";

const sections = [
  {
    title: "1. Data yang Kami Kumpulkan",
    body: [
      {
        heading: "a. Data Akun",
        text: "Alamat email dan kata sandi yang Anda berikan saat mendaftar. Kata sandi disimpan dalam bentuk terenkripsi."
      },
      {
        heading: "b. Data Transaksi Keuangan",
        text: "Seluruh data yang Anda input secara manual ke dalam aplikasi, seperti catatan pemasukan, pengeluaran, jumlah nominal, kategori, serta target atau budget yang Anda tetapkan."
      },
      {
        text: "Fine Pro tidak terhubung langsung ke rekening bank atau kartu Anda. Data keuangan yang tersimpan adalah data yang Anda ketik atau input sendiri."
      },
      {
        heading: "c. Data Teknis",
        text: "Informasi perangkat, sistem operasi, browser, alamat IP, dan log aktivitas penggunaan aplikasi untuk keperluan keamanan dan peningkatan layanan."
      },
      {
        heading: "d. Data Preferensi",
        text: "Pengaturan tampilan, seperti mode terang atau gelap, dan preferensi lain yang Anda atur dalam aplikasi."
      },
      {
        heading: "e. Data Pembayaran",
        text: "Untuk langganan paket berbayar (3 Bulan, Tahunan, atau Lifetime), data pembayaran diproses oleh penyedia payment gateway pihak ketiga berlisensi (Midtrans atau Xendit, tergantung metode yang sedang aktif). Fine Pro tidak menyimpan nomor kartu kredit atau debit Anda di server kami. Apabila Anda memilih metode transfer bank manual, foto bukti transfer dan nomor referensi yang Anda unggah akan tersimpan di server Fine Pro sendiri untuk keperluan verifikasi oleh admin."
      },
      {
        heading: "f. Data Foto & Berkas Unggahan",
        text: "Foto profil yang Anda unggah, serta foto struk belanja yang Anda unggah untuk fitur Scan Struk Otomatis. Foto struk diproses oleh layanan AI pihak ketiga untuk mengekstrak data transaksi, dan tidak disimpan permanen oleh penyedia AI tersebut setelah proses selesai."
      },
      {
        heading: "g. Data Fitur Asisten Chat AI",
        text: "Apabila Anda mengaktifkan Asisten Chat AI melalui WhatsApp atau Telegram, kami memproses nomor WhatsApp atau username Telegram Anda untuk keperluan autentikasi percakapan, beserta isi pesan yang Anda kirimkan ke asisten untuk menghasilkan balasan yang relevan."
      }
    ]
  },
  {
    title: "2. Bagaimana Kami Menggunakan Data Anda",
    list: [
      "Menyediakan fungsi inti layanan, termasuk mencatat transaksi, menghitung saldo, memantau progress budget, dan menampilkan dashboard.",
      "Mengautentikasi dan mengamankan akun Anda.",
      "Mengirim komunikasi terkait layanan, seperti notifikasi budget, pembaruan fitur, atau informasi penting mengenai akun.",
      "Menganalisis penggunaan aplikasi secara agregat untuk perbaikan produk.",
      "Memproses Data Transaksi untuk fitur AI Insight, Scan Struk Otomatis, dan Asisten Chat AI (WhatsApp/Telegram) apabila fitur tersebut aktif dan dipicu secara manual oleh Anda.",
      "Memverifikasi klaim pembayaran transfer manual menggunakan bukti transfer yang Anda unggah.",
      "Memenuhi kewajiban hukum yang berlaku."
    ],
    body: [
      {
        text: "Kami tidak menggunakan Data Transaksi keuangan Anda untuk tujuan periklanan pihak ketiga, dan tidak menjual data pribadi Anda kepada pihak mana pun."
      }
    ]
  },
  {
    title: "3. Dasar Pemrosesan Data",
    body: [
      {
        text: "Kami memproses data pribadi Anda berdasarkan persetujuan eksplisit saat mendaftar, kebutuhan pelaksanaan layanan yang Anda minta, serta kepentingan sah kami untuk menjaga keamanan dan meningkatkan kualitas layanan sepanjang tidak bertentangan dengan hak Anda sebagai pemilik data."
      }
    ]
  },
  {
    title: "4. Berbagi Data dengan Pihak Ketiga",
    list: [
      "Penyedia infrastruktur atau hosting yang menyimpan data secara aman atas nama kami dan terikat kewajiban kerahasiaan.",
      "Penyedia payment gateway (Midtrans atau Xendit), semata-mata untuk memproses pembayaran langganan paket berbayar.",
      "Penyedia layanan AI pihak ketiga, untuk memproses fitur Scan Struk Otomatis, AI Insight, dan Asisten Chat AI (WhatsApp/Telegram).",
      "Pihak yang berwenang apabila diwajibkan oleh perintah pengadilan atau otoritas berwenang di Indonesia sesuai peraturan yang berlaku."
    ],
    body: [
      {
        text: "Kami tidak akan membagikan Data Transaksi keuangan Anda kepada pihak ketiga untuk tujuan komersial tanpa persetujuan eksplisit dari Anda."
      }
    ]
  },
  {
    title: "5. Keamanan Data",
    body: [
      {
        text: "Kami menerapkan langkah-langkah keamanan yang wajar untuk melindungi data Anda, termasuk enkripsi kata sandi, akses terbatas ke sistem produksi, dan pemantauan keamanan berkala. Meskipun demikian, tidak ada sistem elektronik yang sepenuhnya kebal dari risiko keamanan. Kami menghimbau Anda menjaga kerahasiaan kredensial akun dan segera menghubungi kami apabila mencurigai adanya akses tidak sah."
      }
    ]
  },
  {
    title: "6. Penyimpanan dan Retensi Data",
    body: [
      {
        text: "Data Anda disimpan selama akun Anda aktif. Apabila Anda meminta penghapusan akun, kami akan menghapus atau melakukan anonimisasi data pribadi Anda dalam waktu paling lama 30 hari kerja, kecuali terdapat kewajiban hukum yang mengharuskan kami menyimpan data tersebut lebih lama."
      }
    ]
  },
  {
    title: "7. Hak Anda Sebagai Pemilik Data",
    list: [
      "Mengakses data pribadi yang kami simpan tentang Anda.",
      "Memperbaiki data yang tidak akurat.",
      "Menghapus data pribadi Anda dengan konsekuensi akun tidak dapat digunakan kembali.",
      "Menarik persetujuan atas pemrosesan data tertentu.",
      "Meminta salinan atau ekspor data Anda dalam format yang dapat dibaca.",
      "Mengajukan keberatan atas pemrosesan data untuk tujuan tertentu."
    ],
    body: [
      {
        text: "Untuk menggunakan hak-hak ini, hubungi kami melalui kontak pada bagian Hubungi Kami. Kami akan merespons permintaan Anda dalam waktu wajar sesuai peraturan yang berlaku."
      }
    ]
  },
  {
    title: "8. Cookie dan Teknologi Pelacakan",
    body: [
      {
        text: "Fine Pro dapat menggunakan cookie atau teknologi serupa untuk menjaga sesi login Anda tetap aktif dan mengingat preferensi tampilan. Cookie ini bersifat fungsional dan tidak digunakan untuk pelacakan iklan pihak ketiga. Anda dapat mengatur preferensi cookie melalui pengaturan browser."
      }
    ]
  },
  {
    title: "9. Privasi Anak",
    body: [
      {
        text: "Layanan ini tidak ditujukan untuk anak di bawah 18 tahun. Kami tidak dengan sengaja mengumpulkan data pribadi dari anak di bawah usia tersebut. Apabila kami mengetahui adanya data anak yang terkumpul tanpa persetujuan wali yang sah, kami akan menghapusnya sesegera mungkin."
      }
    ]
  },
  {
    title: "10. Perubahan Kebijakan Privasi",
    body: [
      {
        text: "Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu mengikuti perkembangan fitur layanan atau perubahan regulasi. Perubahan material akan diinformasikan melalui email terdaftar atau notifikasi pada aplikasi setidaknya 7 hari sebelum berlaku efektif."
      }
    ]
  },
  {
    title: "11. Ketentuan Kredit AI Paket Lifetime",
    body: [
      {
        text: "Bagian ini merupakan tambahan pada Kebijakan Privasi ini, khusus mengatur fitur berbasis AI (Asisten Chat WhatsApp/Telegram, Scan Struk Otomatis, dan AI Insight) pada paket Lifetime. Ketentuan ini juga ditampilkan secara ringkas di halaman pembelian paket Lifetime."
      },
      {
        heading: "a. Cakupan Akses Lifetime",
        text: "Paket Lifetime memberikan akses selamanya, tanpa batas, dan tanpa biaya tambahan untuk seluruh fitur non-AI — termasuk pencatatan transaksi manual, multi-dompet, kolaborasi & undangan anggota keluarga, budgeting, tagihan & pengingat, arisan & iuran, pos zakat/sedekah, export CSV/PDF, serta dashboard dan laporan keuangan."
      },
      {
        heading: "b. Kredit AI dalam Paket Lifetime",
        text: "Fitur AI (scan struk otomatis, AI Insight, dan asisten chat AI via WhatsApp/Telegram) menggunakan layanan AI pihak ketiga yang memiliki biaya operasional riil. Paket Lifetime menyertakan Kredit AI awal yang bersifat akumulatif (bukan reset berkala seperti paket lain) dan berkurang setiap kali fitur AI digunakan, mengikuti bobot pemakaian masing-masing fitur. Saldo Kredit AI ditampilkan secara transparan dan real-time di halaman Akun."
      },
      {
        heading: "c. Top-Up Kredit AI",
        text: "Apabila Kredit AI habis, pengguna dapat melanjutkan penggunaan fitur AI dengan membeli Top-Up Kredit AI seharga Rp124.500 — harga ini tetap berlaku terlepas dari harga promo Lifetime yang berlaku saat pembelian paket. Top-Up bersifat opsional dan tidak otomatis: tidak ada auto-charge atau penagihan otomatis dalam bentuk apa pun, pengguna harus secara aktif memilih dan menyetujui pembelian Top-Up. Apabila kredit AI habis dan pengguna belum melakukan Top-Up, seluruh fitur non-AI tetap berfungsi normal tanpa gangguan."
      },
      {
        heading: "d. Perubahan Kebijakan",
        text: "Apabila terjadi perubahan signifikan pada biaya penyedia layanan AI atau kebijakan kuota, kami akan menginformasikan perubahan tersebut kepada pengguna paket Lifetime yang sudah aktif melalui email/notifikasi aplikasi minimal 30 hari sebelum berlaku, dan tidak akan mengurangi Kredit AI yang sudah dimiliki pengguna pada saat perubahan kebijakan berlaku."
      }
    ],
    list: [
      "Paket 3 Bulan dan Tahunan mengikuti kuota reset harian/bulanan dan tidak menggunakan sistem akumulasi kredit.",
      "Dengan melakukan pembelian paket Lifetime, pengguna dianggap telah membaca, memahami, dan menyetujui ketentuan Kredit AI dan mekanisme Top-Up sebagaimana diuraikan di atas."
    ]
  }
];

function BrandLogo() {
  return (
    <img
      src="/images/fine-pro-header.png"
      alt="Fine Pro"
      className="h-10 w-auto object-contain"
    />
  );
}

function PolicySection({ section }) {
  return (
    <section className="rounded-3xl border border-white/75 bg-white/80 p-5 shadow-soft md:p-6">
      <h2 className="text-lg font-bold text-navy md:text-xl">{section.title}</h2>
      {section.body?.map((item, index) => (
        <div key={`${section.title}-${index}`} className="mt-4 max-w-prose">
          {item.heading && <h3 className="text-base font-bold text-navy">{item.heading}</h3>}
          <p className="mt-1.5 text-base font-normal leading-7 text-neutral-700">{item.text}</p>
        </div>
      ))}
      {section.list && (
        <ul className="mt-4 grid max-w-prose gap-2.5 text-base font-normal leading-7 text-neutral-700">
          {section.list.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PrivacyPolicyPage({ onBack }) {
  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="app-glow-bg min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-5">
          <a href="/" className="flex items-center" aria-label="Fine Pro">
            <BrandLogo />
          </a>
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white/75 px-4 text-xs font-bold text-neutral-600 shadow-soft transition hover:text-violet"
          >
            <ArrowRight size={14} className="rotate-180" />
            Kembali
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:py-14">
        <div className="gloss-panel rounded-[32px] p-6 md:p-9">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-light px-3 py-1 text-[11px] font-bold text-violet">
                <ShieldCheck size={13} />
                Perlindungan Data Pribadi
              </div>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-navy md:text-4xl">Kebijakan Privasi Fine Pro</h1>
              <p className="mt-4 max-w-prose text-base font-normal leading-7 text-neutral-700">
                Fine Pro menghargai kepercayaan Anda dalam mencatat data keuangan pribadi melalui layanan ini. Kebijakan
                Privasi ini menjelaskan data apa saja yang kami kumpulkan, bagaimana data tersebut digunakan, dilindungi,
                dan hak apa saja yang Anda miliki sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi
                dan peraturan perundang-undangan Indonesia yang berlaku.
              </p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/65 p-4 text-sm font-semibold text-neutral-600 md:min-w-56">
              <div className="flex items-center gap-2 text-navy">
                <FileText size={16} className="text-violet" />
                Informasi dokumen
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <div>
                  <div className="text-neutral-400">Berlaku efektif</div>
                  <div className="text-navy">{EFFECTIVE_DATE}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Terakhir diperbarui</div>
                  <div className="text-navy">{UPDATED_DATE}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-mint-light/80 p-4 text-base font-semibold leading-7 text-navy">
            Dengan menggunakan Fine Pro, Anda menyetujui pengumpulan dan penggunaan data sebagaimana dijelaskan dalam
            kebijakan ini.
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {sections.map((section) => (
            <PolicySection key={section.title} section={section} />
          ))}

          <section className="rounded-3xl border border-white/75 bg-white/65 p-5 shadow-soft">
            <h2 className="text-lg font-bold text-navy md:text-xl">12. Hubungi Kami</h2>
            <p className="mt-3 max-w-prose text-base font-normal leading-7 text-neutral-700">
              Untuk pertanyaan, permintaan akses atau hapus data, dan keluhan terkait privasi, silakan hubungi:
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-3 rounded-2xl bg-white/75 p-4 text-sm font-bold text-navy transition hover:text-violet"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-light text-violet">
                  <Mail size={17} />
                </span>
                {CONTACT_EMAIL}
              </a>
              <a
                href="/#kontak"
                className="flex items-center gap-3 rounded-2xl bg-white/75 p-4 text-sm font-bold text-navy transition hover:text-violet"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint-light text-mint">
                  <ArrowRight size={17} />
                </span>
                Halaman Kontak finepro.my.id
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

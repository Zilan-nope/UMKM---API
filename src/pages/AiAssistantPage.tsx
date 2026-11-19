import {
  Bot,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  RotateCcw,
  Send,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import {
  buildUnifiedBusinessSnapshot,
  type UnifiedBusinessSnapshot,
} from '../lib/analyticsEngine';
import {
  formatCompactRupiah,
  formatFullRupiah,
  formatPercent,
} from '../lib/formatters';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  modeBadge?: 'Online AI' | 'Offline';
  timestamp: string;
}

const STORAGE_KEY_API = 'smart_umkm_gemini_api_key';

const QUICK_PROMPTS = [
  'Produk apa yang paling laris dan paling menguntungkan?',
  'Barang apa saja yang stoknya menipis dan harus kulakan?',
  'Evaluasi omzet, laba kotor, dan arus kas usaha saya saat ini.',
  'Berikan 3 langkah praktis untuk menaikkan keuntungan bulan ini.',
];

function buildBusinessContextPrompt(
  businessName: string,
  currency: string,
  snap: UnifiedBusinessSnapshot
): string {
  const rp = (n: number) => formatFullRupiah(n, currency);
  const topProductsText =
    snap.topProducts.length > 0
      ? snap.topProducts
          .slice(0, 8)
          .map(
            (p, idx) =>
              `${idx + 1}. ${p.name} (terjual ${p.qtySold} unit, omzet ${rp(p.revenue)}, laba kotor ${rp(p.grossProfit)})`
          )
          .join('\n')
      : 'Belum ada data produk terjual.';

  const lowStockText =
    snap.lowStockItems.length > 0
      ? snap.lowStockItems
          .slice(0, 8)
          .map((i) => `- ${i.name}: sisa ${i.stock} unit (batas min. ${i.minStock})`)
          .join('\n')
      : 'Semua stok aman di atas batas minimum.';

  return [
    `Anda adalah Konsultan Bisnis & Keuangan UMKM yang cerdas, ramah, dan to the point.`,
    `Jawab dalam Bahasa Indonesia berdasarkan DATA AKTUAL usaha berikut (jangan mengarang angka di luar data):`,
    ``,
    `Nama Usaha: ${businessName}`,
    `Total Transaksi Penjualan: ${snap.totalTransactions} transaksi`,
    `Total Omzet Penjualan: ${rp(snap.totalRevenue)}`,
    `Pemasukan Lainnya: ${rp(snap.otherIncome)}`,
    `HPP Aktual (Modal Terjual): ${rp(snap.totalActualHpp)}`,
    `Laba Kotor Aktual: ${rp(snap.totalGrossProfitActual)} (Margin ${formatPercent(snap.grossMarginPercent)})`,
    `Total Pengeluaran Kas: ${rp(snap.totalExpense)}`,
    `Arus Kas Operasional Bersih: ${rp(snap.netOperatingCashflow)}`,
    `Total SKU Produk: ${snap.totalProductSku} SKU (${snap.totalStockUnits} unit, nilai aset stok ${rp(snap.inventoryAssetValue)})`,
    ``,
    `Produk Terlaris:`,
    topProductsText,
    ``,
    `Status Stok Menipis:`,
    lowStockText,
  ].join('\n');
}

function generateLocalFallbackAnswer(
  question: string,
  businessName: string,
  currency: string,
  snap: UnifiedBusinessSnapshot
): string {
  const q = question.toLowerCase();
  const rp = (n: number) => formatFullRupiah(n, currency);
  const rpShort = (n: number) => formatCompactRupiah(n, currency);

  if (snap.totalTransactions === 0 && snap.totalProductSku === 0 && snap.totalExpense === 0) {
    return `Data usaha ${businessName} masih kosong. Silakan unggah file CSV/Excel atau catat transaksi terlebih dahulu di menu Data & Import.`;
  }

  if (/(stok|habis|kulakan|restock|gudang|sisa)/.test(q)) {
    if (snap.totalProductSku === 0) {
      return `Belum ada data Produk & Stok di database ${businessName}.`;
    }
    if (snap.lowStockItems.length === 0) {
      return `Seluruh ${snap.totalProductSku} produk (${snap.totalStockUnits} unit, nilai aset ${rp(snap.inventoryAssetValue)}) dalam kondisi aman di atas batas minimum.`;
    }
    const list = snap.lowStockItems
      .slice(0, 8)
      .map((i) => `• ${i.name}: sisa ${i.stock} unit (min. ${i.minStock})`)
      .join('\n');
    return `Ada ${snap.lowStockItems.length} barang yang perlu segera dikulak:\n${list}`;
  }

  if (/(laris|produk|terbaik|top|laku|untung)/.test(q) && !/(kas|arus|pengeluaran)/.test(q)) {
    if (snap.topProducts.length === 0) {
      return `Belum ada data transaksi penjualan untuk melihat produk terlaris.`;
    }
    const list = snap.topProducts
      .slice(0, 5)
      .map(
        (p, idx) =>
          `${idx + 1}. ${p.name} — ${p.qtySold} unit, omzet ${rp(p.revenue)}${p.hasActualHpp ? ` (laba ${rpShort(p.grossProfit)})` : ''}`
      )
      .join('\n');
    return `5 Produk Terlaris di ${businessName}:\n${list}`;
  }

  return (
    `Ringkasan Keuangan ${businessName}:\n` +
    `• Omzet Penjualan: ${rp(snap.totalRevenue)} (${snap.totalTransactions.toLocaleString('id-ID')} transaksi)\n` +
    `• HPP Aktual: ${rp(snap.totalActualHpp)}\n` +
    `• Laba Kotor: ${rp(snap.totalGrossProfitActual)} (Margin ${formatPercent(snap.grossMarginPercent)})\n` +
    `• Pengeluaran Kas: ${rp(snap.totalExpense)}\n` +
    `• Arus Kas Bersih: ${rp(snap.netOperatingCashflow)}\n` +
    `• Stok Menipis: ${snap.lowStockItems.length} dari ${snap.totalProductSku} SKU`
  );
}

async function queryGeminiOnline(
  apiKey: string,
  systemContext: string,
  userQuestion: string
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemContext }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userQuestion }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API Error (${response.status}): ${errBody.slice(0, 140)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!replyText) {
    throw new Error('Respons AI kosong.');
  }
  return replyText;
}

export function AiAssistantPage() {
  const { savedDatasets, businessProfile } = useApp();
  const currency = businessProfile.currency || 'IDR';

  const envApiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() ?? '';
  const [savedApiKey, setSavedApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_API) || envApiKey;
    } catch {
      return envApiKey;
    }
  });
  const [apiKeyInput, setApiKeyInput] = useState<string>(savedApiKey);
  const [showApiPanel, setShowApiPanel] = useState<boolean>(!savedApiKey);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState('');

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(savedDatasets),
    [savedDatasets]
  );

  const initialGreeting = (): ChatMessage => ({
    id: 'welcome',
    sender: 'ai',
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    text: `Halo ${businessProfile.ownerName || 'Pemilik Usaha'}! Silakan pilih pertanyaan cepat di bawah atau tanyakan kondisi penjualan, stok, dan keuangan ${businessProfile.name}.`,
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialGreeting()]);

  const handleSaveApiKey = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = apiKeyInput.trim();
    setSavedApiKey(cleaned);
    try {
      if (cleaned) localStorage.setItem(STORAGE_KEY_API, cleaned);
      else localStorage.removeItem(STORAGE_KEY_API);
    } catch {
      // Abaikan jika localStorage dibatasi
    }
    setShowApiPanel(false);
  };

  const askQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isSending) return;

    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: 'user', text: trimmed, timestamp: nowTime },
    ]);
    setInput('');
    setIsSending(true);

    try {
      if (savedApiKey) {
        const contextPrompt = buildBusinessContextPrompt(
          businessProfile.name,
          currency,
          snapshot
        );
        const aiReply = await queryGeminiOnline(savedApiKey, contextPrompt, trimmed);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'ai',
            text: aiReply,
            modeBadge: 'Online AI',
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      } else {
        const localReply = generateLocalFallbackAnswer(
          trimmed,
          businessProfile.name,
          currency,
          snapshot
        );
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'ai',
            text: localReply,
            modeBadge: 'Offline',
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Koneksi API gagal';
      const fallbackReply = generateLocalFallbackAnswer(
        trimmed,
        businessProfile.name,
        currency,
        snapshot
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'ai',
          text: `(Koneksi API bermasalah: ${errMsg}. Menggunakan hitungan data lokal)\n\n${fallbackReply}`,
          modeBadge: 'Offline',
          timestamp: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void askQuestion(input);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* STATUS KONEKSI API ONLINE & AKSI RINGKAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm">Asisten Bisnis UMKM</h2>
              {savedApiKey ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                  <Wifi className="w-3 h-3" />
                  <span>Online (Gemini API)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                  <WifiOff className="w-3 h-3" />
                  <span>Mode Offline</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Terhubung ke {savedDatasets.length} dataset usaha Anda secara langsung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowApiPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            <span>{savedApiKey ? 'Ganti API Key' : 'Hubungkan API Online'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMessages([initialGreeting()])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            title="Bersihkan percakapan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* PANEL PENGATURAN GEMINI API KEY */}
      {showApiPanel && (
        <form
          onSubmit={handleSaveApiKey}
          className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold">
              Masukkan Google Gemini API Key (untuk jawaban AI Online cerdas):
            </label>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
            >
              <span>Dapatkan API Key Gratis</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 min-w-56 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Simpan API Key</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            API Key disimpan di browser perangkat Anda saja. Kosongkan & simpan jika ingin kembali ke mode offline.
          </p>
        </form>
      )}

      {/* AREA CHAT TO THE POINT */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="space-y-3 max-h-[26rem] overflow-y-auto p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {msg.text}
              </div>
              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                <span>{msg.timestamp}</span>
                {msg.modeBadge && (
                  <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold">
                    <Sparkles className="w-2.5 h-2.5" />
                    {msg.modeBadge}
                  </span>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="text-xs text-slate-500 italic px-2">
              Asisten sedang menganalisis data usaha Anda...
            </div>
          )}
        </div>

        {/* PERTANYAAN CEPAT */}
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isSending}
              onClick={() => void askQuestion(prompt)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 text-xs font-medium text-left transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* INPUT PERTANYAAN */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pertanyaan tentang penjualan, stok, atau keuangan usaha..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold"
          >
            <Send className="w-4 h-4" />
            <span>Kirim</span>
          </button>
        </form>
      </div>
    </div>
  );
}
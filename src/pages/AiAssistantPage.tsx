import {
  Loader2,
  RotateCcw,
  Send,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import {
  askSmartAi,
  getProviderLabel,
  loadSavedApiKey,
  type ChatTurn,
} from '../lib/aiProviders';
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
  time: string;
}

const STARTER_CHIPS = [
  'Produk paling laris?',
  'Stok yang hampir habis?',
  'Ringkasan omzet & laba',
  'Saran praktis menaikkan keuntungan',
];

function renderInlineBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-950 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormattedAiMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          return (
            <p key={i} className="font-bold text-emerald-700 dark:text-emerald-300 pt-1">
              {renderInlineBold(trimmed.replace(/^#{2,3}\s+/, ''))}
            </p>
          );
        }

        if (/^(\d+\.|[-•*])\s+/.test(trimmed)) {
          return (
            <div key={i} className="pl-2 border-l-2 border-emerald-500/50">
              {renderInlineBold(trimmed)}
            </div>
          );
        }

        return <p key={i}>{renderInlineBold(trimmed)}</p>;
      })}
    </div>
  );
}

function buildConciseContext(
  businessName: string,
  currency: string,
  snap: UnifiedBusinessSnapshot
): string {
  const rp = (n: number) => formatFullRupiah(n, currency);
  const topList = snap.topProducts
    .slice(0, 5)
    .map((p) => `${p.name} (${p.qtySold} unit, omzet ${rp(p.revenue)}, laba ${rp(p.grossProfit)})`)
    .join('; ');
  const lowStockList = snap.lowStockItems
    .slice(0, 6)
    .map((i) => `${i.name} (sisa ${i.stock}, min ${i.minStock})`)
    .join('; ');

  return [
    `Anda adalah konsultan bisnis untuk "${businessName}".`,
    `ATURAN WAJIB JAWABAN:`,
    `1. Gunakan Bahasa Indonesia sehari-hari yang sederhana, ramah, dan langsung mudah dipahami pemilik toko/UMKM.`,
    `2. DILARANG KERAS membuat tabel Markdown (|---|) atau tag HTML (<br>).`,
    `3. Gunakan paragraf pendek dan poin bernomor (1., 2., 3.) dengan penjelasan praktis yang singkat.`,
    `Data usaha aktual: Transaksi=${snap.totalTransactions}, Omzet=${rp(snap.totalRevenue)}, HPP=${rp(snap.totalActualHpp)}, Laba Kotor=${rp(snap.totalGrossProfitActual)} (${formatPercent(snap.grossMarginPercent)}), Pengeluaran=${rp(snap.totalExpense)}, Arus Kas Bersih=${rp(snap.netOperatingCashflow)}, Total SKU=${snap.totalProductSku}.`,
    topList ? `Produk terlaris: ${topList}.` : '',
    lowStockList ? `Stok menipis: ${lowStockList}.` : 'Stok semua barang aman.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildOfflineReply(
  question: string,
  businessName: string,
  currency: string,
  snap: UnifiedBusinessSnapshot
): string {
  const q = question.toLowerCase();
  const rp = (n: number) => formatFullRupiah(n, currency);
  const rpShort = (n: number) => formatCompactRupiah(n, currency);

  if (/^(halo|hai|hi|pagi|siang|sore|malam|tes|test|bisa apa)/.test(q.trim())) {
    return `Halo! Saya siap membantu mengecek penjualan, stok menipis, dan laba ${businessName}.`;
  }

  if (snap.totalTransactions === 0 && snap.totalProductSku === 0 && snap.totalExpense === 0) {
    return `Belum ada data di ${businessName}. Silakan unggah data terlebih dahulu di menu Data & Import.`;
  }

  if (/(stok|habis|kulakan|restock|sisa)/.test(q)) {
    if (snap.lowStockItems.length === 0) {
      return `Semua ${snap.totalProductSku} produk stoknya aman.`;
    }
    return (
      `Stok yang perlu segera kulakan:\n` +
      snap.lowStockItems
        .slice(0, 6)
        .map((i, idx) => `${idx + 1}. **${i.name}** — sisa ${i.stock} unit (batas min. ${i.minStock})`)
        .join('\n')
    );
  }

  if (/(laris|produk|laku|terbaik|top)/.test(q)) {
    if (snap.topProducts.length === 0) return `Belum ada data penjualan produk.`;
    return (
      `Produk paling laris:\n` +
      snap.topProducts
        .slice(0, 5)
        .map(
          (p, i) =>
            `${i + 1}. **${p.name}** — terjual ${p.qtySold} unit (${rpShort(p.revenue)})`
        )
        .join('\n')
    );
  }

  return (
    `Ringkasan **${businessName}**:\n` +
    `1. **Omzet**: ${rp(snap.totalRevenue)} (${snap.totalTransactions.toLocaleString('id-ID')} transaksi)\n` +
    `2. **Laba Kotor**: ${rp(snap.totalGrossProfitActual)} (Margin ${formatPercent(snap.grossMarginPercent)})\n` +
    `3. **Pengeluaran**: ${rp(snap.totalExpense)}\n` +
    `4. **Arus Kas Bersih**: ${rp(snap.netOperatingCashflow)}`
  );
}

export function AiAssistantPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const currency = businessProfile.currency || 'IDR';
  const apiKey = loadSavedApiKey();
  const providerLabel = getProviderLabel(apiKey);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const snapshot = useMemo(
    () => buildUnifiedBusinessSnapshot(savedDatasets),
    [savedDatasets]
  );

  const handleSend = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    const now = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const history: ChatTurn[] = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: 'user', text, time: now },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      if (apiKey.trim()) {
        const { reply } = await askSmartAi({
          apiKey,
          systemPrompt: buildConciseContext(businessProfile.name, currency, snapshot),
          history,
          userQuestion: text,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'ai',
            text: reply,
            time: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            sender: 'ai',
            text: buildOfflineReply(text, businessProfile.name, currency, snapshot),
            time: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ]);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Koneksi API gagal';
      const fallback = buildOfflineReply(text, businessProfile.name, currency, snapshot);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'ai',
          text: `${reason}\n\n${fallback}`,
          time: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl w-full mx-auto flex flex-col gap-3 min-h-[calc(100vh-8.5rem)]">
      {/* Bar Status Atas */}
      <div className="flex items-center justify-between gap-2 px-1">
        {apiKey ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <Wifi className="w-3.5 h-3.5" />
            <span>Online • {providerLabel}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Mode Offline</span>
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActivePage('pengaturan')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-xs font-semibold"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-600" />
            <span>{apiKey ? 'Ubah API Key' : 'Atur API Key'}</span>
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500"
              title="Bersihkan chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Kotak Chat Lebar & Tinggi di PC */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col justify-between min-h-[calc(100vh-12rem)]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 ? (
            <div className="h-full min-h-[22rem] flex flex-col items-center justify-center text-center px-4 space-y-4">
              <p className="text-base font-medium text-slate-600 dark:text-slate-300">
                Tanyakan apa saja seputar penjualan, stok, atau strategi usaha{' '}
                <strong className="text-slate-900 dark:text-white">
                  {businessProfile.name}
                </strong>
                .
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void handleSend(chip)}
                    className="px-3.5 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-4 py-3 ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white text-sm leading-relaxed whitespace-pre-line'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.sender === 'user' ? (
                    m.text
                  ) : (
                    <FormattedAiMessage text={m.text} />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
              </div>
            ))
          )}

          {isLoading && (
            <div className="inline-flex items-center gap-2 text-xs text-slate-400 px-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Menjawab...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(input);
          }}
          className="flex items-center gap-2.5 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pertanyaan Anda..."
            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold"
          >
            <Send className="w-4 h-4" />
            <span>Kirim</span>
          </button>
        </form>
      </div>
    </div>
  );
}
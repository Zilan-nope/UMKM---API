import {
  Loader2,
  RotateCcw,
  Send,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
];

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
    `Anda adalah asisten bisnis untuk "${businessName}".`,
    `Jawab singkat, ramah, jelas, dan hanya berikan informasi yang relevan dengan pertanyaan user dalam Bahasa Indonesia.`,
    `Data usaha: Transaksi=${snap.totalTransactions}, Omzet=${rp(snap.totalRevenue)}, HPP=${rp(snap.totalActualHpp)}, Laba Kotor=${rp(snap.totalGrossProfitActual)} (${formatPercent(snap.grossMarginPercent)}), Pengeluaran=${rp(snap.totalExpense)}, Arus Kas Bersih=${rp(snap.netOperatingCashflow)}, Total SKU=${snap.totalProductSku}.`,
    topList ? `Produk terlaris: ${topList}.` : '',
    lowStockList ? `Stok menipis: ${lowStockList}.` : 'Stok aman.',
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
        .map((i) => `• ${i.name} (sisa ${i.stock}, min ${i.minStock})`)
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
            `${i + 1}. ${p.name} — ${p.qtySold} unit (${rpShort(p.revenue)})`
        )
        .join('\n')
    );
  }

  return (
    `• Omzet: ${rp(snap.totalRevenue)} (${snap.totalTransactions.toLocaleString('id-ID')} transaksi)\n` +
    `• Laba Kotor: ${rp(snap.totalGrossProfitActual)} (${formatPercent(snap.grossMarginPercent)})\n` +
    `• Pengeluaran: ${rp(snap.totalExpense)}\n` +
    `• Arus Kas Bersih: ${rp(snap.netOperatingCashflow)}`
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
    <div className="max-w-3xl mx-auto flex flex-col gap-3">
      {/* Status Koneksi Minimalis */}
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

      {/* Kotak Chat Bersih */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between min-h-[28rem]">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[24rem]">
          {messages.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center px-4 space-y-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Tanyakan apa saja seputar penjualan, stok, atau laba{' '}
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
                    className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors"
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.text}
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
          className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pertanyaan Anda..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
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
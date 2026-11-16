import {
  Bot,
  PlusCircle,
  Send,
  Settings,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import {
  calculateFinanceMetrics,
  calculateGenericMetrics,
  calculateInventoryMetrics,
  calculateSalesMetrics,
} from '../lib/analyticsEngine';
import { generateSmartOfflineReply } from '../lib/localAiEngine';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  badge?: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

interface OpenAiCompatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

interface ModelsListResponse {
  data?: { id: string }[];
}

const PROMPT_SUGGESTIONS = [
  'Laporan untung rugi sekarang',
  'Cek stok barang menipis',
  'Produk paling laris',
  'Buat teks promosi WA',
];

function detectProviderLabel(key: string): string {
  if (key.startsWith('gsk_')) return 'Groq';
  if (key.startsWith('csk-')) return 'Cerebras';
  if (key.startsWith('sk-or-')) return 'OpenRouter';
  if (key.startsWith('github_pat_') || key.startsWith('ghp_')) return 'GitHub Models';
  if (key.startsWith('AIza')) return 'Google Gemini';
  if (key.startsWith('xai-')) return 'xAI Grok';
  return 'Mistral AI';
}

export function AiAssistantPage() {
  const { savedDatasets, businessProfile, setActivePage } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'ai',
      text: `Halo ${businessProfile.ownerName}, siap cek data "${businessProfile.name}". Silakan tanya langsung.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const aiMode = localStorage.getItem('smart_umkm_ai_mode') === 'hybrid' ? 'hybrid' : 'offline';
  const apiKey = (localStorage.getItem('smart_umkm_gemini_key') ?? '').trim();

  const rp = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: businessProfile.currency,
      maximumFractionDigits: 0,
    }).format(n);

  const buildFullBusinessReport = (): string => {
    const salesDs = savedDatasets.find((d) => d.category === 'sales' && d.rows.length > 0);
    const buyDs = savedDatasets.find((d) => d.category === 'finance' && d.rows.length > 0);
    const invDs = savedDatasets.find((d) => d.category === 'inventory' && d.rows.length > 0);
    const empDs = savedDatasets.find((d) => d.category === 'employee' && d.rows.length > 0);

    const todayStr = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    const sections: string[] = [`Tanggal Hari Ini: ${todayStr}`];

    if (salesDs) {
      const m = calculateSalesMetrics(salesDs);
      sections.push(
        `PENJUALAN (${m.totalTransactions} transaksi): Omzet ${rp(m.totalRevenue)}, Terjual ${m.totalUnits} unit, Laba Kotor ${m.hasCostData ? `${rp(m.totalGrossProfit)} (${m.grossMarginPercent.toFixed(1)}%)` : 'belum diisi modal'}, Terlaris: ${m.topProducts.slice(0, 5).map((p) => `${p.name} (${p.qty} unit / ${rp(p.revenue)})`).join(', ')}.`
      );
    }
    if (buyDs) {
      const f = calculateFinanceMetrics(buyDs);
      const totalBuy = f.totalExpense > 0 ? f.totalExpense : f.totalIncome;
      sections.push(`PEMBELIAN & PENGELUARAN (${buyDs.rows.length} catatan): Total ${rp(totalBuy)}.`);
    }
    if (invDs) {
      const inv = calculateInventoryMetrics(invDs);
      sections.push(
        `STOK (${inv.totalItems} produk, ${inv.totalStockUnits} unit): Menipis: ${inv.lowStockItems.length > 0 ? inv.lowStockItems.map((i) => `${i.name} (sisa ${i.current})`).join(', ') : 'Aman'}.`
      );
    }
    if (empDs) {
      const emp = calculateGenericMetrics(empDs);
      sections.push(`KARYAWAN (${emp.totalRecords} orang): Total Gaji ${rp(emp.totalNumericValue)}/bln.`);
    }

    return sections.join('\n');
  };

  const callOpenAiCompatibleAuto = async (
    baseUrl: string,
    providerTitle: string,
    key: string,
    defaultModels: string[],
    systemPrompt: string,
    userQuestion: string,
    fetchLiveModels = true
  ): Promise<{ reply: string; providerLabel: string }> => {
    const models = [...defaultModels];

    if (fetchLiveModels) {
      try {
        const listRes = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (listRes.ok) {
          const listData = (await listRes.json()) as ModelsListResponse;
          const activeIds = (listData.data ?? [])
            .map((m) => m.id)
            .filter(
              (id) =>
                !id.includes('whisper') &&
                !id.includes('guard') &&
                !id.includes('tts') &&
                !id.includes('embed') &&
                !models.includes(id)
            );
          models.push(...activeIds.slice(0, 3));
        }
      } catch {
        // Lanjut pakai defaultModels
      }
    }

    let lastErr = `Gagal menghubungi ${providerTitle}.`;
    for (const model of models) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuestion },
          ],
          temperature: 0.4,
        }),
      });
      const data = (await res.json()) as OpenAiCompatResponse;
      const reply = data.choices?.[0]?.message?.content;
      if (res.ok && reply) {
        return { reply, providerLabel: `${providerTitle} (${model})` };
      }
      lastErr = data.error?.message ?? `${providerTitle} HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) break;
    }

    throw new Error(lastErr);
  };

  const callOnlineAiProvider = async (
    key: string,
    systemPrompt: string,
    userQuestion: string
  ): Promise<{ reply: string; providerLabel: string }> => {
    // 1. Groq (gsk_...)
    if (key.startsWith('gsk_')) {
      return callOpenAiCompatibleAuto(
        'https://api.groq.com/openai/v1',
        'Groq AI',
        key,
        ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
        systemPrompt,
        userQuestion
      );
    }

    // 2. Cerebras (csk-...)
    if (key.startsWith('csk-')) {
      return callOpenAiCompatibleAuto(
        'https://api.cerebras.ai/v1',
        'Cerebras AI',
        key,
        ['gpt-oss-120b', 'llama-3.3-70b', 'qwen-3-32b'],
        systemPrompt,
        userQuestion
      );
    }

    // 3. OpenRouter (sk-or-...)
    if (key.startsWith('sk-or-')) {
      return callOpenAiCompatibleAuto(
        'https://openrouter.ai/api/v1',
        'OpenRouter',
        key,
        ['openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'],
        systemPrompt,
        userQuestion,
        false
      );
    }

    // 4. GitHub Models (github_pat_... / ghp_...)
    if (key.startsWith('github_pat_') || key.startsWith('ghp_')) {
      return callOpenAiCompatibleAuto(
        'https://models.github.ai/inference',
        'GitHub Models',
        key,
        ['openai/gpt-4o-mini', 'meta/Llama-3.3-70B-Instruct'],
        systemPrompt,
        userQuestion,
        false
      );
    }

    // 5. xAI Grok (xai-...)
    if (key.startsWith('xai-')) {
      return callOpenAiCompatibleAuto(
        'https://api.x.ai/v1',
        'xAI Grok',
        key,
        ['grok-3-mini'],
        systemPrompt,
        userQuestion,
        false
      );
    }

    // 6. Google Gemini (AIza...)
    if (key.startsWith('AIza')) {
      const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
      let lastError = 'Gagal menghubungi API Gemini.';
      for (const model of models) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nPertanyaan: ${userQuestion}` }] }],
            }),
          }
        );
        const data = (await res.json()) as GeminiResponse;
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (res.ok && reply) return { reply, providerLabel: `Gemini (${model})` };
        lastError = data.error?.message ?? `Gemini HTTP ${res.status}`;
        if (res.status !== 404) break;
      }
      throw new Error(lastError);
    }

    // 7. Mistral AI (kunci alfanumerik 32 karakter)
    return callOpenAiCompatibleAuto(
      'https://api.mistral.ai/v1',
      'Mistral AI',
      key,
      ['mistral-small-latest', 'open-mistral-nemo'],
      systemPrompt,
      userQuestion,
      false
    );
  };

  const askAssistant = async (question: string) => {
    const cleanQ = question.trim();
    if (!cleanQ || loading) return;

    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, sender: 'user', text: cleanQ }]);
    setInput('');
    setLoading(true);

    const localContext = { datasets: savedDatasets, profile: businessProfile };

    try {
      if (aiMode === 'hybrid' && apiKey) {
        if (!navigator.onLine) {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai_${Date.now()}`,
              sender: 'ai',
              text: generateSmartOfflineReply(cleanQ, localContext),
              badge: 'Offline (Tidak ada internet)',
            },
          ]);
          return;
        }

        const context = buildFullBusinessReport();
        const systemPrompt =
          `Kamu asisten bisnis UMKM untuk "${businessProfile.name}" (${businessProfile.city}). ` +
          `Jawab dalam Bahasa Indonesia secara SINGKAT, PADAT, TO THE POINT, dan praktis. ` +
          `Gunakan data berikut jika terkait pembukuan:\n${context}`;

        try {
          const { reply, providerLabel } = await callOnlineAiProvider(apiKey, systemPrompt, cleanQ);
          setMessages((prev) => [
            ...prev,
            { id: `ai_${Date.now()}`, sender: 'ai', text: reply, badge: providerLabel },
          ]);
          return;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Kendala API';
          setMessages((prev) => [
            ...prev,
            {
              id: `ai_${Date.now()}`,
              sender: 'ai',
              text: `⚠️ API gagal (${errMsg}):\n\n${generateSmartOfflineReply(cleanQ, localContext)}`,
              badge: 'AI Lokal Cadangan',
            },
          ]);
          return;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: 'ai',
          text: generateSmartOfflineReply(cleanQ, localContext),
          badge: 'AI Lokal Offline',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void askAssistant(input);
  };

  const hasAnyRows = savedDatasets.some((d) => d.rows.length > 0);

  if (!hasAnyRows) {
    return (
      <div className="max-w-xl mx-auto mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
        <Bot className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold">Database Usaha Masih Kosong</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2">
          Isi minimal satu data di Database Usaha agar AI bisa menganalisis.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('database')}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-semibold"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Isi Database Usaha</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600 text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base">Asisten AI Usaha</h2>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              {aiMode === 'hybrid' && apiKey ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mode Online ({detectProviderLabel(apiKey)})</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mode Offline Lokal</span>
                </>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActivePage('pengaturan')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Atur API Key</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 min-h-72 max-h-96 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 text-xs sm:text-sm whitespace-pre-line leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
              }`}
            >
              {msg.text}
            </div>
            {msg.badge && (
              <span className="text-[11px] text-slate-400 mt-1 px-1">{msg.badge}</span>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 animate-pulse text-emerald-600" />
            <span>Memproses...</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void askAssistant(q)}
            className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ketik pertanyaanmu..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
        >
          <Send className="w-4 h-4" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
}
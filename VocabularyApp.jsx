import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  CheckCircle, 
  Filter,
  BarChart2,
  Upload,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Home,
  Volume2,
  Eye,
  Trash2,
  Zap,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';

const App = () => {
  const [view, setView] = useState('study'); 
  const [words, setWords] = useState([]);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [masteredIds, setMasteredIds] = useState(new Set()); // 永久不再出現的單字
  const [progress, setProgress] = useState({}); // 遺忘曲線進度 { id: { stage, lastReview } }
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [importStatus, setImportStatus] = useState('等待上傳 10000word.csv');
  const [searchTerm, setSearchTerm] = useState('');

  const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 15, 30];

  useEffect(() => {
    const savedMastered = localStorage.getItem('voca_mastered');
    const savedProgress = localStorage.getItem('voca_progress');
    const savedSettings = localStorage.getItem('voca_settings');
    const savedWords = localStorage.getItem('voca_raw_words');

    if (savedMastered) { try { setMasteredIds(new Set(JSON.parse(savedMastered))); } catch(e) {}}
    if (savedProgress) { try { setProgress(JSON.parse(savedProgress)); } catch(e) {}}
    if (savedSettings) { try { setDailyTarget(JSON.parse(savedSettings).dailyTarget || 20); } catch(e) {}}
    if (savedWords) {
      try {
        const parsed = JSON.parse(savedWords);
        if (parsed && parsed.length > 0) {
          setWords(parsed);
          setIsLoaded(true);
        }
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('voca_mastered', JSON.stringify(Array.from(masteredIds)));
    localStorage.setItem('voca_progress', JSON.stringify(progress));
    localStorage.setItem('voca_settings', JSON.stringify({ dailyTarget }));
  }, [masteredIds, progress, dailyTarget]);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const parseCSV = (text) => {
    try {
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
          if (inQuotes && text[i+1] === '"') { currentField += '"'; i++; } 
          else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) { currentRow.push(currentField.trim()); currentField = ''; } 
        else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); rows.push(currentRow); currentField = ''; currentRow = []; }
          if (char === '\r' && text[i+1] === '\n') i++;
        } else { currentField += char; }
      }
      if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); rows.push(currentRow); }

      const formattedData = rows.slice(1)
        .filter(row => row.length >= 3 && row[0])
        .map((row, index) => ({
          id: index, 
          word: row[0], 
          phonetic: row[1], 
          definition: row[2].replace(/\\n/g, '\n'), 
          sentence: (row[3] || '').replace(/\\n/g, '\n'), 
          frequency: parseInt(row[4]) || 0 
        }));

      setWords(formattedData);
      setIsLoaded(true);
      localStorage.setItem('voca_raw_words', JSON.stringify(formattedData));
    } catch (error) {
      setImportStatus('CSV 解析失敗：' + error.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target.result;
        const view = new Uint8Array(buffer);
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        try {
          parseCSV(utf8Decoder.decode(view));
        } catch (e) {
          const gbkDecoder = new TextDecoder('gbk');
          parseCSV(gbkDecoder.decode(view));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const todayTasks = useMemo(() => {
    if (!words.length) return [];
    const now = new Date().getTime();
    const msInDay = 24 * 60 * 60 * 1000;

    const toReview = words.filter(w => {
      const p = progress[w.id];
      if (!p || masteredIds.has(w.id)) return false;
      const daysSinceLastReview = (now - p.lastReview) / msInDay;
      return daysSinceLastReview >= REVIEW_INTERVALS[p.stage];
    });

    const newWords = [];
    if (toReview.length < dailyTarget) {
      const limit = dailyTarget - toReview.length;
      for (let w of words) {
        if (!progress[w.id] && !masteredIds.has(w.id)) {
          newWords.push(w);
          if (newWords.length >= limit) break;
        }
      }
    }

    return [...toReview, ...newWords].sort((a, b) => (progress[a.id]?.stage || 0) - (progress[b.id]?.stage || 0));
  }, [words, progress, masteredIds, dailyTarget]);

  const handleReviewAction = (id, type) => {
    const now = new Date().getTime();
    
    if (type === 'mastered') {
      setMasteredIds(prev => new Set(prev).add(id));
    } else if (type === 'known') {
      const current = progress[id] || { stage: 0, lastReview: 0 };
      const nextStage = Math.min(current.stage + 1, REVIEW_INTERVALS.length - 1);
      setProgress(prev => ({ ...prev, [id]: { lastReview: now, stage: nextStage } }));
    } else if (type === 'forgot') {
      setProgress(prev => ({ ...prev, [id]: { lastReview: now, stage: 1 } }));
    }

    if (currentIndex < todayTasks.length - 1) { 
      setCurrentIndex(currentIndex + 1); 
      setShowDefinition(false); 
    } else { 
      setView('stats'); 
    }
  };

  const toggleMastered = (id) => {
    setMasteredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredWords = useMemo(() => {
    if (!searchTerm) return words.slice(0, 150);
    return words.filter(w => w.word.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 150);
  }, [words, searchTerm]);

  const formatFreq = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num/1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans max-w-md mx-auto border-x border-zinc-800 shadow-2xl overflow-hidden">
      <header className="bg-black p-4 border-b border-zinc-800 flex justify-between items-center z-10">
        <h1 className="text-2xl font-bold tracking-tighter italic" style={{ fontFamily: 'Brush Script MT, cursive' }}>
          vocabgram
        </h1>
        <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2">
                <span className="text-[10px] text-zinc-500 font-bold leading-none uppercase">Today's Pool</span>
                <span className="text-sm font-black text-indigo-400 leading-none">{todayTasks.length}</span>
            </div>
          <Zap size={20} className="text-yellow-400 fill-yellow-400" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {!isLoaded ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-3xl flex items-center justify-center p-0.5">
              <div className="bg-black w-full h-full rounded-[22px] flex items-center justify-center">
                <Upload size={32} />
              </div>
            </div>
            <h2 className="text-xl font-bold">同步你的遺忘曲線</h2>
            <p className="text-zinc-500 text-sm leading-relaxed">{importStatus}</p>
            <label className="bg-white text-black px-8 py-3 rounded-lg font-bold cursor-pointer hover:bg-zinc-200 transition-colors">
              選擇檔案
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <>
            {view === 'study' && (
              <div className="pb-20">
                {todayTasks.length > 0 && todayTasks[currentIndex] ? (
                  <div className="flex flex-col">
                    <div className="flex items-center p-3 gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5">
                        <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-[10px] font-bold">LV{progress[todayTasks[currentIndex].id]?.stage || 0}</div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">Memory Cycle</span>
                        <span className="text-[10px] text-zinc-500">
                            {progress[todayTasks[currentIndex].id] ? 'Reviewing' : 'New Learning'}
                        </span>
                      </div>
                      <MoreHorizontal size={18} className="ml-auto text-zinc-500" />
                    </div>

                    <div className="relative aspect-square bg-zinc-900 flex flex-col items-center justify-center border-y border-zinc-800 px-8">
                       <h2 
                        className="text-5xl font-black tracking-tight mb-4 text-center break-words w-full"
                        onClick={() => speak(todayTasks[currentIndex].word)}
                       >
                        {todayTasks[currentIndex].word}
                      </h2>
                      <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                        <p className="text-zinc-400 text-sm font-medium">{todayTasks[currentIndex].phonetic}</p>
                        <Volume2 size={16} className="text-indigo-400 cursor-pointer" onClick={() => speak(todayTasks[currentIndex].word)} />
                      </div>
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-bold">
                        {currentIndex + 1} / {todayTasks.length}
                      </div>
                    </div>

                    <div className="p-3 flex gap-4 items-center">
                      <Heart 
                        size={28} 
                        className={showDefinition ? "text-red-500 fill-red-500" : "text-white"} 
                        onClick={() => setShowDefinition(!showDefinition)}
                      />
                      <MessageCircle size={28} onClick={() => speak(todayTasks[currentIndex].word)} className="cursor-pointer" />
                      <Bookmark size={28} className="ml-auto" />
                    </div>

                    <div className="px-4 space-y-2 pb-8">
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        <Eye size={14} className="text-zinc-500" />
                        <span className="text-zinc-400">{formatFreq(todayTasks[currentIndex].frequency)} views</span>
                      </div>
                      
                      {showDefinition && (
                        <div className="mt-2 bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                           <div>
                             <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-1">解釋</p>
                             <p className="text-lg leading-relaxed text-zinc-100 font-medium">{todayTasks[currentIndex].definition}</p>
                           </div>
                           {todayTasks[currentIndex].sentence && (
                             <div>
                               <p className="text-pink-400 text-[10px] font-bold uppercase tracking-wider mb-1">情境</p>
                               <p className="text-sm text-zinc-400 italic leading-snug">{todayTasks[currentIndex].sentence}</p>
                             </div>
                           )}
                        </div>
                      )}

                      <div className="pt-4 flex flex-col gap-2">
                        {!showDefinition ? (
                          <button 
                            onClick={() => setShowDefinition(true)}
                            className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm uppercase tracking-widest"
                          >
                            顯示內容
                          </button>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => handleReviewAction(todayTasks[currentIndex].id, 'forgot')}
                              className="py-4 bg-zinc-900 text-red-400 border border-zinc-800 rounded-xl font-bold text-xs uppercase tracking-tighter"
                            >
                              不熟練 (重來)
                            </button>
                            <button 
                              onClick={() => handleReviewAction(todayTasks[currentIndex].id, 'known')}
                              className="py-4 bg-zinc-900 text-emerald-400 border border-zinc-800 rounded-xl font-bold text-xs uppercase tracking-tighter"
                            >
                              記住了 (進階)
                            </button>
                            <button 
                              onClick={() => handleReviewAction(todayTasks[currentIndex].id, 'mastered')}
                              className="col-span-2 py-3 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-widest mt-1 hover:bg-zinc-200"
                            >
                              已經會了 (永久不再出現)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8">
                    <div className="w-16 h-16 rounded-full border-2 border-emerald-500 flex items-center justify-center mb-6">
                      <CheckCircle className="text-emerald-500" size={32} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">任務達成！</h2>
                    <p className="text-zinc-500 text-sm">今日的遺忘曲線複習已完成。<br/>明天再來檢查需要複習的單字。</p>
                  </div>
                )}
              </div>
            )}

            {view === 'list' && (
              <div className="p-4 space-y-4 pb-24">
                <div className="flex justify-between items-end">
                  <h2 className="text-xl font-bold">單字總庫</h2>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Learning Progress</p>
                    <p className="text-lg font-black text-emerald-400 leading-none">
                      {masteredIds.size} <span className="text-zinc-600 font-normal text-xs">/ {words.length}</span>
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text"
                    placeholder="搜尋單字..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {filteredWords.map(w => (
                    <div 
                      key={w.id} 
                      className={`flex items-center p-3 rounded-2xl border transition-all ${
                        masteredIds.has(w.id) 
                        ? 'bg-emerald-950/20 border-emerald-900/30 opacity-70' 
                        : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <button 
                        onClick={() => toggleMastered(w.id)}
                        className={`mr-3 p-1 rounded-md transition-colors ${
                          masteredIds.has(w.id) ? 'text-emerald-500' : 'text-zinc-700'
                        }`}
                      >
                        {masteredIds.has(w.id) ? <CheckSquare size={24} /> : <Square size={24} />}
                      </button>

                      <div className="flex-1" onClick={() => speak(w.word)}>
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-base ${masteredIds.has(w.id) ? 'text-emerald-200/50 line-through' : 'text-white'}`}>
                            {w.word}
                          </p>
                          <span className="text-[10px] text-zinc-600 font-mono">Stage {progress[w.id]?.stage || 0}</span>
                        </div>
                        <p className="text-xs text-zinc-500 line-clamp-1">{w.definition}</p>
                      </div>

                      <div className="text-[10px] text-zinc-700 font-bold">
                        {formatFreq(w.frequency)}
                      </div>
                    </div>
                  ))}
                  {filteredWords.length === 0 && (
                    <p className="text-center py-10 text-zinc-600 text-sm italic">找不對應的單字...</p>
                  )}
                  {words.length > 150 && !searchTerm && (
                    <p className="text-center py-4 text-zinc-700 text-[10px] uppercase font-bold tracking-widest">
                      僅顯示前 150 筆，請使用搜尋尋找特定單字
                    </p>
                  )}
                </div>
              </div>
            )}

            {view === 'stats' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-bold">學習大數據</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 tracking-widest">已經會了 (Mastered)</p>
                        <p className="text-4xl font-black text-white">{masteredIds.size}</p>
                        <p className="text-[10px] text-emerald-500 mt-2 font-bold italic">
                          佔總庫的 {((masteredIds.size / words.length) * 100).toFixed(1)}%
                        </p>
                    </div>
                    <CheckCircle size={60} className="text-emerald-500 opacity-10 absolute -right-2 -bottom-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-center">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">正在複習</p>
                        <p className="text-3xl font-black text-indigo-400">{Object.keys(progress).length}</p>
                      </div>
                      <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 text-center">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">未接觸單字</p>
                        <p className="text-3xl font-black text-zinc-500">{words.length - masteredIds.size - Object.keys(progress).length}</p>
                      </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'settings' && (
              <div className="p-6 space-y-8">
                <h2 className="text-xl font-bold">系統設定</h2>
                <div className="space-y-4 bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
                  <label className="block text-sm font-bold text-zinc-400 uppercase tracking-widest">每日新詞限制</label>
                  <div className="flex items-center gap-6">
                    <input 
                      type="range" min="5" max="100" step="5"
                      value={dailyTarget}
                      onChange={(e) => setDailyTarget(parseInt(e.target.value))}
                      className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <span className="text-3xl font-black">{dailyTarget}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">註：系統會優先安排「到期複習」的單字，複習完後才會補足新詞至此限額。</p>
                </div>
                <button 
                  onClick={() => { if(window.confirm('確定要清除所有進度嗎？')) { localStorage.clear(); window.location.reload(); } }}
                  className="w-full p-5 bg-red-950/30 text-red-500 border border-red-900/50 rounded-2xl font-bold transition-all hover:bg-red-950/50 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  清除並重置所有數據
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {isLoaded && (
        <nav className="bg-black border-t border-zinc-800 flex justify-around p-4 pb-8 sticky bottom-0 z-20">
          <button onClick={() => setView('study')} className={view === 'study' ? 'text-white' : 'text-zinc-600'}>
            <Home size={28} />
          </button>
          <button onClick={() => setView('list')} className={view === 'list' ? 'text-white' : 'text-zinc-600'}>
            <Filter size={28} />
          </button>
          <button onClick={() => setView('stats')} className={view === 'stats' ? 'text-white' : 'text-zinc-600'}>
            <BarChart2 size={28} />
          </button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'text-white' : 'text-zinc-600'}>
            <Settings size={28} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;

import React, { useState, useRef, useEffect } from 'react';
import { VoiceName, GeneratedAudio, TTSConfig } from './types';
import { ttsService } from './services/gemini-service';

const VOICES = Object.values(VoiceName);
const EMOTIONS = ["neutral", "cheerful", "serious", "calm", "excited", "whispering", "sad", "angry", "friendly"];

export default function App() {
  const [text, setText] = useState("");
  const [config, setConfig] = useState<TTSConfig>({
    voice: VoiceName.Kore,
    emotion: "neutral",
    speed: 1.0,
    pitch: 0,
    voiceDescription: "",
  });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GeneratedAudio[]>([]);
  const [currentAudio, setCurrentAudio] = useState<GeneratedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refFileName, setRefFileName] = useState<string | null>(null);
  
  // API Key State Manual
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [tempKey, setTempKey] = useState("");
  const [showKeyText, setShowKeyText] = useState(false); // Toggle show/hide key

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load API Key from local storage on mount
    const storedKey = localStorage.getItem("echovocal_api_key");
    if (storedKey) {
      setApiKey(storedKey);
      ttsService.setApiKey(storedKey);
    } else {
        const currentServiceKey = ttsService.getApiKey();
        if(currentServiceKey) setApiKey(currentServiceKey);
    }
  }, []);

  useEffect(() => {
    if (config.voice === VoiceName.Custom && descriptionRef.current) {
      descriptionRef.current.focus();
    }
  }, [config.voice]);

  // Focus input saat modal terbuka
  useEffect(() => {
    if (showKeyModal && keyInputRef.current) {
        setTimeout(() => {
            keyInputRef.current?.focus();
            keyInputRef.current?.select();
        }, 100);
    }
  }, [showKeyModal]);

  const handleSaveKey = () => {
    if (!tempKey.trim()) return;
    localStorage.setItem("echovocal_api_key", tempKey.trim());
    setApiKey(tempKey.trim());
    ttsService.setApiKey(tempKey.trim());
    setShowKeyModal(false);
    setError(null); 
  };

  const handleOpenKeyModal = () => {
    setTempKey(apiKey);
    setShowKeyText(false);
    setShowKeyModal(true);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // Limit 10MB
      setError("File terlalu besar. Maksimal 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setConfig(prev => ({
        ...prev,
        referenceAudio: {
          data: base64,
          mimeType: file.type || 'audio/mpeg'
        }
      }));
      setRefFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const removeReference = () => {
    setConfig(prev => ({ ...prev, referenceAudio: undefined }));
    setRefFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    if (config.voice === VoiceName.Custom && !config.voiceDescription.trim() && !config.referenceAudio) {
      setError("Silakan masukkan deskripsi atau unggah audio referensi untuk mode kustom.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { blob, url } = await ttsService.generateSpeech(text, config);
      
      const newEntry: GeneratedAudio = {
        id: crypto.randomUUID(),
        text: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
        voice: config.voice,
        timestamp: Date.now(),
        url,
        blob,
        config: { ...config }
      };

      setHistory(prev => [newEntry, ...prev]);
      setCurrentAudio(newEntry);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = config.speed;
        audioRef.current.play();
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghasilkan audio. Silakan coba lagi.");
      if (err.message.includes("429") || err.message.includes("API Key")) {
        setShowKeyModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const playFromHistory = (item: GeneratedAudio) => {
    setCurrentAudio(item);
    if (audioRef.current) {
      audioRef.current.src = item.url;
      audioRef.current.playbackRate = item.config.speed;
      audioRef.current.play();
    }
  };

  const downloadAudio = (item: GeneratedAudio) => {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = `echovocal-${item.id.slice(0, 8)}.wav`;
    a.click();
  };

  const shareAudio = async (item: GeneratedAudio) => {
    if (!navigator.share) {
      alert("Fitur berbagi tidak didukung di browser ini.");
      return;
    }

    try {
      const file = new File([item.blob], `audio-${item.id.slice(0, 8)}.wav`, { type: "audio/wav" });
      await navigator.share({
        title: 'EchoVocal Audio',
        text: `Dengarkan audio dari EchoVocal: "${item.text}"`,
        files: [file],
      });
    } catch (err) {
      console.error("Sharing failed", err);
    }
  };

  const clearHistory = () => {
    history.forEach(item => URL.revokeObjectURL(item.url));
    setHistory([]);
    setCurrentAudio(null);
  };

  const isCustom = config.voice === VoiceName.Custom;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-6 px-4 relative">
      
      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden scale-in relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="fas fa-key text-yellow-500"></i> Pengaturan API Key
              </h3>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Masukkan API Key Google Gemini (AI Studio) Anda. Key ini akan disimpan secara lokal di browser Anda.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                    <span>Google Gemini API Key</span>
                    {tempKey && (
                        <button onClick={() => setTempKey("")} className="text-red-500 text-[10px] hover:underline font-bold">Clear</button>
                    )}
                </label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"></i>
                  <input 
                    ref={keyInputRef}
                    type={showKeyText ? "text" : "password"}
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="Masukkan API Key (AIzaSy...)"
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700 font-mono text-sm bg-white"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <button 
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 p-2 z-10 transition-colors"
                    title={showKeyText ? "Sembunyikan Key" : "Tampilkan Key"}
                  >
                    <i className={`fas ${showKeyText ? "fa-eye-slash" : "fa-eye"}`}></i>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 pt-1">
                  Belum punya key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-medium">Dapatkan API Key Gratis di sini</a>
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors hover:bg-slate-200 rounded-xl"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveKey}
                disabled={!tempKey.trim()}
                className={`px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg transition-all ${
                    tempKey.trim() 
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' 
                    : 'bg-slate-300 cursor-not-allowed shadow-none'
                }`}
              >
                Simpan Key
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left Section: Input & Controls */}
        <div className="w-full lg:w-[65%] p-6 lg:p-10 border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto max-h-[95vh]">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
                <span className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-200">
                  <i className="fas fa-wave-square"></i>
                </span>
                EchoVocal
              </h1>
              <p className="text-slate-500 mt-1 font-medium italic">Cloning & Customisasi Suara Generasi Baru</p>
            </div>
            <button 
              onClick={handleOpenKeyModal}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${apiKey ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              title="Ganti Akun / API Key"
            >
              <i className={`fas fa-key ${apiKey ? 'text-green-500' : 'text-slate-400'}`}></i>
              {apiKey ? 'API Key Aktif' : 'Set API Key'}
            </button>
          </header>

          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <i className="fas fa-pen-nib text-blue-500"></i> Masukkan Teks
              </label>
              <textarea
                className="w-full h-44 p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none outline-none text-slate-700 leading-relaxed shadow-inner"
                placeholder="Tuliskan kata-kata yang ingin Anda ubah menjadi suara..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="absolute bottom-4 right-4 text-xs font-semibold text-slate-400 bg-white/50 px-2 py-1 rounded">
                <span>{text.length} karakter</span>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border transition-all space-y-6 ${isCustom ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/5' : 'bg-slate-50/50 border-slate-100 shadow-inner'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className={`fas ${isCustom ? 'fa-wand-magic-sparkles text-indigo-500' : 'fa-sliders text-slate-500'}`}></i>
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Pilihan Suara & Referensi</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Suara Dasar</label>
                    <div className="relative">
                      <select
                        className={`w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 shadow-sm appearance-none ${isCustom ? 'border-indigo-300 ring-2 ring-indigo-500/10' : ''}`}
                        value={config.voice}
                        onChange={(e) => setConfig({ ...config, voice: e.target.value as VoiceName })}
                      >
                        {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gaya / Emosi</label>
                    <div className="relative">
                      <select
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 shadow-sm capitalize appearance-none"
                        value={config.emotion}
                        onChange={(e) => setConfig({ ...config, emotion: e.target.value })}
                      >
                        {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <i className="fas fa-microphone-lines text-indigo-500"></i> Referensi Suara (Clone)
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative h-28 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${config.referenceAudio ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 hover:border-blue-400'}`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="audio/*" 
                      className="hidden" 
                    />
                    {config.referenceAudio ? (
                      <div className="text-center px-4">
                        <i className="fas fa-check-circle text-indigo-600 mb-2"></i>
                        <p className="text-[10px] font-bold text-indigo-700 truncate max-w-[150px]">{refFileName}</p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeReference(); }}
                          className="mt-1 text-[9px] text-red-500 hover:underline font-bold"
                        >
                          Hapus Referensi
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <i className="fas fa-cloud-upload-alt text-slate-300 text-xl mb-2"></i>
                        <p className="text-[10px] text-slate-400 font-medium">Klik untuk unggah sampel suara</p>
                        <p className="text-[9px] text-slate-300 mt-1">MP3, WAV, M4A (Maks 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kecepatan</label>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{config.speed}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1" 
                      value={config.speed}
                      onChange={(e) => setConfig({ ...config, speed: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nada (Pitch)</label>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{config.pitch > 0 ? `+${config.pitch}` : config.pitch}</span>
                    </div>
                    <input 
                      type="range" min="-10" max="10" step="1" 
                      value={config.pitch}
                      onChange={(e) => setConfig({ ...config, pitch: parseInt(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
              </div>

              <div className="space-y-2">
                <label className={`block text-xs font-bold uppercase tracking-wider transition-colors ${isCustom ? 'text-indigo-600' : 'text-slate-500'}`}>
                   Deskripsi Suara / Instruksi Tambahan
                </label>
                <textarea
                  ref={descriptionRef}
                  className={`w-full h-20 p-4 bg-white border rounded-xl outline-none focus:ring-2 font-medium text-slate-700 shadow-sm text-sm resize-none transition-all ${isCustom ? 'border-indigo-400 focus:ring-indigo-500' : 'border-slate-200 focus:ring-blue-500'}`}
                  placeholder="Misal: Suara dengan aksen medok, suara anak kecil, atau instruksi vokal spesifik lainnya..."
                  value={config.voiceDescription}
                  onChange={(e) => setConfig({ ...config, voiceDescription: e.target.value })}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm flex flex-col md:flex-row items-center justify-between gap-3 animate-bounce shadow-sm">
                <div className="flex items-center gap-3">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span className="font-semibold">{error}</span>
                </div>
                {(error.includes("429") || error.includes("404") || error.includes("API Key")) && (
                    <button 
                        onClick={handleOpenKeyModal}
                        className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50"
                    >
                        Ganti API Key
                    </button>
                )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
              className={`w-full py-5 rounded-2xl font-bold text-white flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${
                loading || !text.trim() ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 hover:shadow-2xl hover:shadow-blue-200'
              }`}
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch animate-spin text-xl"></i>
                  <span>Sedang Mengkloning Suara...</span>
                </>
              ) : (
                <>
                  <i className={`fas ${config.referenceAudio ? 'fa-microphone-lines' : isCustom ? 'fa-wand-magic-sparkles' : 'fa-play-circle'} text-xl`}></i>
                  <span>{config.referenceAudio ? 'Gunakan Clone Suara' : 'Hasilkan Audio'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Section: Player & History */}
        <div className="w-full lg:w-[35%] p-6 lg:p-10 bg-slate-50 flex flex-col h-full max-h-[95vh]">
          <div className="mb-10">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <i className="fas fa-compact-disc text-blue-500"></i>
              Pemutar
            </h2>
            {currentAudio ? (
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 transition-all scale-in">
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 bg-gradient-to-br ${currentAudio.config.referenceAudio ? 'from-purple-500 to-indigo-600' : currentAudio.config.voice === VoiceName.Custom ? 'from-indigo-500 to-purple-600' : 'from-blue-500 to-indigo-600'} text-white rounded-2xl flex items-center justify-center shadow-md shrink-0`}>
                    <i className={`fas ${currentAudio.config.referenceAudio ? 'fa-microphone-lines' : 'fa-waveform-path'} text-xl animate-pulse`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{currentAudio.text}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-600">
                        {currentAudio.config.referenceAudio ? 'Voice Clone' : currentAudio.voice}
                      </span>
                    </div>
                  </div>
                </div>
                
                <audio ref={audioRef} controls className="w-full mb-6 custom-audio-player" />
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => downloadAudio(currentAudio)}
                    className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-slate-800 rounded-xl hover:bg-black transition-colors"
                  >
                    <i className="fas fa-download"></i> Simpan
                  </button>
                  <button 
                    onClick={() => shareAudio(currentAudio)}
                    className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    <i className="fas fa-share-nodes"></i> Share
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/70 border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-400 text-center space-y-4 shadow-inner">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-headphones text-2xl"></i>
                </div>
                <p className="text-sm font-medium">Buat audio untuk mengaktifkan pemutar.</p>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Riwayat</h2>
                <p className="text-xs text-slate-400 font-medium">{history.length} file tersimpan</p>
              </div>
              {history.length > 0 && (
                <button 
                  onClick={clearHistory} 
                  className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {history.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-300 opacity-60">
                  <i className="fas fa-history text-4xl mb-3"></i>
                  <p className="text-sm font-medium">Kosong</p>
                </div>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => playFromHistory(item)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
                      currentAudio?.id === item.id ? 'bg-white border-blue-500 ring-4 ring-blue-500/10 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        currentAudio?.id === item.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'
                      }`}>
                        <i className="fas fa-play text-[10px]"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate mb-1">{item.text}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${item.config.referenceAudio ? 'bg-purple-100 text-purple-600' : 'bg-slate-50 text-slate-400'}`}>
                            {item.config.referenceAudio ? 'Clone' : item.voice === VoiceName.Custom ? 'Kustom' : item.voice}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadAudio(item); }}
                          className="p-2 text-slate-400 hover:text-blue-600"
                        >
                          <i className="fas fa-download text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 flex flex-col items-center gap-2 text-slate-400">
        <p className="text-[10px] font-bold tracking-[0.3em] text-slate-300">ECHOVOCAL PREVIEW • AI VOICE CLONING ENABLED</p>
      </footer>

      <style>{`
        .scale-in { animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2); }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: white;
          border: 2px solid currentColor;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          margin-top: -7px;
        }

        input[type='range']::-webkit-slider-runnable-track {
          width: 100%;
          height: 2px;
          cursor: pointer;
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}

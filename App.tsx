
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { editImage, generateSuggestedPrompts } from './services/geminiService';
import { ImageState, EditHistoryItem, SuggestedPrompt } from './types';

const INITIAL_PROMPT = `Without changing the face. High-angle POV, medium close-up of a young South Asian woman with long messy dark hair, reclining on floral bedding. Intimate calm gaze, dewy makeup with pink blush and highlighter. Wearing pastel pink chiffon ethnic wear with shimmering gold Zari work, jhumkas, and bangles. Hard on-camera flash lighting, deep vignette, dark bedroom background with wooden headboard. Lo-fi grainy CCD texture nostalgic mood.`;

export default function App() {
  const [imageState, setImageState] = useState<ImageState>({
    originalUrl: '',
    isProcessing: false,
    showComparison: false,
  });
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Explorer Modal State
  const [showExplorer, setShowExplorer] = useState(false);
  const [previews, setPreviews] = useState<Record<string, { url: string; loading: boolean }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!process.env.API_KEY) {
      setImageState(prev => ({ 
        ...prev, 
        error: "Critical: API_KEY environment variable is missing. The editor will not function." 
      }));
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageSource(file);
  };

  const processImageSource = (source: File | string) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImageState({
        originalUrl: base64,
        isProcessing: false,
        error: undefined,
        showComparison: false
      });
      fetchSuggestions(base64);
    };

    if (source instanceof File) {
      reader.readAsDataURL(source);
    } else {
      setImageState({
        originalUrl: source,
        isProcessing: false,
        error: undefined,
        showComparison: false
      });
      fetchSuggestions(source);
    }
  };

  const fetchSuggestions = async (base64: string) => {
    setIsGeneratingSuggestions(true);
    setPreviews({}); // Reset previews for new image
    try {
      const suggestions = await generateSuggestedPrompts(base64);
      setSuggestedPrompts(suggestions);
    } catch (err) {
      console.error("Prompt generation failed", err);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const generatePreview = async (suggestion: SuggestedPrompt) => {
    if (!imageState.originalUrl) return;
    
    setPreviews(prev => ({ ...prev, [suggestion.id]: { url: '', loading: true } }));
    
    try {
      const url = await editImage(imageState.originalUrl, suggestion.prompt);
      setPreviews(prev => ({ ...prev, [suggestion.id]: { url, loading: false } }));
    } catch (err) {
      console.error("Preview failed", err);
      setPreviews(prev => ({ ...prev, [suggestion.id]: { url: '', loading: false } }));
    }
  };

  const handleEdit = async () => {
    if (!imageState.originalUrl || !prompt) return;
    setImageState(prev => ({ ...prev, isProcessing: true, error: undefined }));
    try {
      const editedUrl = await editImage(imageState.originalUrl, prompt);
      setImageState(prev => ({ ...prev, editedUrl, isProcessing: false }));
      const newHistoryItem: EditHistoryItem = {
        id: Date.now().toString(),
        url: editedUrl,
        prompt: prompt,
        timestamp: Date.now(),
      };
      setHistory(prev => [newHistoryItem, ...prev]);
    } catch (err: any) {
      setImageState(prev => ({ ...prev, isProcessing: false, error: err.message }));
    }
  };

  const selectStyle = (style: SuggestedPrompt) => {
    setPrompt(style.prompt);
    setShowExplorer(false);
  };

  const clearImage = () => {
    setImageState({ originalUrl: '', isProcessing: false, showComparison: false });
    setSuggestedPrompts([]);
    setPreviews({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumina-edit-${Date.now()}.png`;
    link.click();
  };

  const viralChoice = suggestedPrompts[0];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
              <i className="fa-solid fa-wand-magic-sparkles text-white text-sm"></i>
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Lumina Edit</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}>
              Billing
            </Button>
            <span className="text-[10px] px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
              Gemini 3 & 2.5 Active
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {/* Main Preview Area */}
          <div className="relative aspect-[4/3] md:aspect-[16/10] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex items-center justify-center group shadow-2xl transition-all duration-500 hover:border-zinc-700">
            {isCameraActive ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-8 flex space-x-4">
                  <Button onClick={() => {}} variant="primary" icon={<i className="fa-solid fa-camera"></i>}>Capture Photo</Button>
                  <Button onClick={() => setIsCameraActive(false)} variant="secondary">Cancel</Button>
                </div>
              </div>
            ) : !imageState.originalUrl ? (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700 shadow-inner">
                  <i className="fa-solid fa-image text-zinc-500 text-3xl"></i>
                </div>
                <h3 className="text-lg font-medium mb-2">Ready to transform?</h3>
                <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">Upload a photo to explore viral AI aesthetics.</p>
                <div className="flex justify-center space-x-3">
                  <Button onClick={() => fileInputRef.current?.click()} icon={<i className="fa-solid fa-cloud-arrow-up"></i>}>Choose File</Button>
                  <Button variant="secondary" onClick={() => setIsCameraActive(true)} icon={<i className="fa-solid fa-camera"></i>}>Camera</Button>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img src={imageState.editedUrl || imageState.originalUrl} alt="Workspace" className={`w-full h-full object-contain transition-all duration-700 ${imageState.isProcessing ? 'blur-sm grayscale opacity-50' : ''}`} />
                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {imageState.editedUrl && (
                    <Button variant="secondary" className="!p-2 h-10 w-10" onClick={() => downloadImage(imageState.editedUrl!)}><i className="fa-solid fa-download"></i></Button>
                  )}
                  <Button variant="danger" className="!p-2 h-10 w-10" onClick={clearImage}><i className="fa-solid fa-trash-can"></i></Button>
                </div>
                {imageState.isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/40 backdrop-blur-sm">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-indigo-400 font-bold tracking-widest text-xs uppercase animate-pulse">Rendering Masterpiece</p>
                  </div>
                )}
                {imageState.editedUrl && !imageState.isProcessing && (
                  <div className="absolute bottom-4 left-4 flex space-x-2">
                    <span className="bg-indigo-600 text-[9px] uppercase font-bold px-2 py-1 rounded">V2 Result</span>
                    <button onMouseDown={() => setImageState(s => ({...s, showComparison: true}))} onMouseUp={() => setImageState(s => ({...s, showComparison: false}))} className="bg-zinc-800 text-[9px] uppercase font-bold px-2 py-1 rounded active:bg-zinc-700 transition-colors">Hold Comparison</button>
                  </div>
                )}
                {imageState.showComparison && <img src={imageState.originalUrl} className="absolute inset-0 w-full h-full object-contain z-10" />}
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            {imageState.originalUrl && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-fire text-orange-500 text-xs"></i>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Viral Styles</h3>
                  </div>
                  <button 
                    onClick={() => setShowExplorer(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 transition-all"
                  >
                    <span>View Extended Gallery</span>
                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                  </button>
                </div>

                {isGeneratingSuggestions ? (
                  <div className="w-full h-24 bg-zinc-950 rounded-xl border border-zinc-800/50 animate-pulse"></div>
                ) : viralChoice && (
                  <div 
                    onClick={() => setPrompt(viralChoice.prompt)}
                    className="relative p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 via-zinc-900 to-transparent border border-indigo-500/20 cursor-pointer hover:border-indigo-500/50 transition-all group overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-500 text-[8px] font-black uppercase tracking-widest rounded-bl-lg shadow-lg">Trending</div>
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner group-hover:bg-indigo-500/20 transition-all">
                        <i className={`fa-solid ${viralChoice.icon} text-lg text-indigo-400`}></i>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-1">{viralChoice.label}</h4>
                        <p className="text-[10px] text-zinc-500 leading-tight line-clamp-2 italic">{viralChoice.sampleOutcome}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center">
                  <i className="fa-solid fa-pen-nib mr-2 text-indigo-500"></i>
                  Style Definition
                </label>
                <button onClick={() => setPrompt(INITIAL_PROMPT)} className="text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-tighter">Clear Prompt</button>
              </div>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the cinematic shift..." className="w-full h-28 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder-zinc-700 focus:ring-1 focus:ring-indigo-500 transition-all resize-none outline-none text-sm" />
              <div className="flex justify-end space-x-3">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>New Source</Button>
                <Button onClick={handleEdit} disabled={!imageState.originalUrl || !prompt || imageState.isProcessing} isLoading={imageState.isProcessing} icon={<i className="fa-solid fa-bolt-lightning"></i>}>Apply Style</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 h-full">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full max-h-[750px]">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Edit Archive</h2>
              <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">{history.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center py-20 opacity-20"><i className="fa-solid fa-images text-4xl mb-2"></i><p className="text-xs">Archive Empty</p></div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="group relative bg-zinc-950 rounded-xl border border-zinc-800 p-2 hover:border-indigo-500/30 transition-all cursor-pointer">
                    <div className="aspect-square rounded-lg overflow-hidden bg-zinc-900 mb-2">
                      <img src={item.url} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] text-zinc-600 font-mono uppercase">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setImageState(s => ({...s, editedUrl: item.url}))} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"><i className="fa-solid fa-eye text-[9px]"></i></button>
                        <button onClick={() => downloadImage(item.url)} className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"><i className="fa-solid fa-download text-[9px]"></i></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Style Explorer Modal */}
      {showExplorer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">VIRAL STYLE MATRIX</h2>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Discover trending AI transformations for your photo</p>
              </div>
              <button onClick={() => setShowExplorer(false)} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 custom-scrollbar">
              {suggestedPrompts.map((style) => (
                <div key={style.id} className="group flex flex-col bg-zinc-950 rounded-2xl border border-zinc-800 p-4 hover:border-indigo-500/50 transition-all duration-300">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-4 border border-zinc-800 group-hover:border-zinc-700">
                    {previews[style.id]?.loading ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-500/5 animate-pulse">
                        <i className="fa-solid fa-circle-notch fa-spin text-indigo-500 text-xl"></i>
                        <span className="text-[8px] uppercase font-black text-indigo-400 mt-2">Generating Sample</span>
                      </div>
                    ) : previews[style.id]?.url ? (
                      <img src={previews[style.id].url} className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                        <i className={`fa-solid ${style.icon} text-4xl mb-2`}></i>
                        <span className="text-[10px] font-bold">Style Preview</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors flex items-center">
                      <i className={`fa-solid ${style.icon} mr-2 text-sm opacity-50`}></i>
                      {style.label}
                    </h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed italic border-l-2 border-indigo-500/20 pl-3">
                      "{style.sampleOutcome}"
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => generatePreview(style)}
                      disabled={previews[style.id]?.loading}
                      className="flex items-center justify-center space-x-2 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 hover:border-zinc-700 transition-all disabled:opacity-50"
                    >
                      <i className="fa-solid fa-wand-sparkles text-indigo-500"></i>
                      <span>{previews[style.id]?.url ? "Regenerate" : "Preview Result"}</span>
                    </button>
                    <button 
                      onClick={() => selectStyle(style)}
                      className="flex items-center justify-center space-x-2 py-2 rounded-lg bg-indigo-600 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-[0_4px_10px_rgba(79,70,229,0.3)]"
                    >
                      <i className="fa-solid fa-check"></i>
                      <span>Select Style</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 text-center">
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Select a style to load it into the main engine workspace</p>
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 border-t border-zinc-900 opacity-50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-600">Lumina AI &bull; Stylistic Synthesis Engine &bull; Gemini Powered</p>
        </div>
      </footer>
    </div>
  );
}

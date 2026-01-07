
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { editImage, generateSuggestedPrompts } from './services/geminiService';
import { ImageState, EditHistoryItem } from './types';

const INITIAL_PROMPT = `Without changing the face. High-angle POV, medium close-up of a young South Asian woman with long messy dark hair, reclining on floral bedding. Intimate calm gaze, dewy makeup with pink blush and highlighter. Wearing pastel pink chiffon ethnic wear with shimmering gold Zari work, jhumkas, and bangles. Hard on-camera flash lighting, deep vignette, dark bedroom background with wooden headboard. Lo-fi grainy CCD texture nostalgic mood.`;

interface SuggestedPrompt {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

export default function App() {
  const [imageState, setImageState] = useState<ImageState & { _showOrig?: boolean }>({
    originalUrl: '',
    isProcessing: false,
  });
  const [prompt, setPrompt] = useState(INITIAL_PROMPT);
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setImageState({
          originalUrl: base64,
          isProcessing: false,
          error: undefined
        });
        
        // Trigger suggestion generation
        setIsGeneratingSuggestions(true);
        try {
          const suggestions = await generateSuggestedPrompts(base64);
          setSuggestedPrompts(suggestions);
        } catch (err) {
          console.error("Prompt generation failed", err);
        } finally {
          setIsGeneratingSuggestions(false);
        }
      };
      reader.readAsDataURL(file);
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

  const clearImage = () => {
    setImageState({ originalUrl: '', isProcessing: false });
    setSuggestedPrompts([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumina-edit-${Date.now()}.png`;
    link.click();
  };

  const applySuggestedPrompt = (p: string) => {
    setPrompt(p);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-wand-magic-sparkles text-white text-sm"></i>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Lumina Edit</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}>
              Billing Info
            </Button>
            <span className="text-xs px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
              Gemini 3 + 2.5
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editor Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Viewport */}
          <div className="relative aspect-[4/3] md:aspect-[16/10] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex items-center justify-center group shadow-2xl">
            {!imageState.originalUrl ? (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700 shadow-inner">
                  <i className="fa-solid fa-image text-zinc-500 text-3xl"></i>
                </div>
                <h3 className="text-lg font-medium mb-2">Upload an image to start</h3>
                <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">
                  Select a photo you'd like to stylize or transform with AI.
                </p>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  icon={<i className="fa-solid fa-cloud-arrow-up"></i>}
                >
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img 
                  src={imageState.editedUrl || imageState.originalUrl} 
                  alt="Editor workspace"
                  className={`w-full h-full object-contain transition-all duration-700 ${imageState.isProcessing ? 'blur-sm grayscale opacity-50' : ''}`}
                />
                
                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {imageState.editedUrl && (
                    <Button 
                      variant="secondary" 
                      className="!p-2 h-10 w-10" 
                      onClick={() => downloadImage(imageState.editedUrl!)}
                      title="Download"
                    >
                      <i className="fa-solid fa-download"></i>
                    </Button>
                  )}
                  <Button 
                    variant="danger" 
                    className="!p-2 h-10 w-10" 
                    onClick={clearImage}
                    title="Clear"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </Button>
                </div>

                {imageState.isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-zinc-950/30 backdrop-blur-[2px]">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-indigo-400 font-medium animate-pulse">Lumina is imagining your edit...</p>
                  </div>
                )}

                {imageState.editedUrl && !imageState.isProcessing && (
                  <div className="absolute bottom-4 left-4 flex space-x-2">
                    <span className="bg-indigo-600 text-[10px] uppercase font-bold px-2 py-1 rounded shadow-lg">
                      AI Generated Result
                    </span>
                    <button 
                      onMouseDown={() => setImageState(s => ({...s, _showOrig: true}))}
                      onMouseUp={() => setImageState(s => ({...s, _showOrig: false}))}
                      onTouchStart={() => setImageState(s => ({...s, _showOrig: true}))}
                      onTouchEnd={() => setImageState(s => ({...s, _showOrig: false}))}
                      className="bg-zinc-800 text-[10px] uppercase font-bold px-2 py-1 rounded shadow-lg active:bg-zinc-700 select-none cursor-pointer"
                    >
                      Hold to compare
                    </button>
                  </div>
                )}
                
                {imageState._showOrig && imageState.editedUrl && (
                   <img 
                    src={imageState.originalUrl} 
                    alt="Original comparison"
                    className="absolute inset-0 w-full h-full object-contain z-10"
                  />
                )}
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Suggested Prompts Section */}
            {imageState.originalUrl && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-wand-magic text-indigo-400 text-xs"></i>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Dynamic Style Suggestions</h3>
                  </div>
                  {isGeneratingSuggestions && (
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-500 animate-pulse">
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Analyzing image...</span>
                    </div>
                  )}
                </div>
                
                <div className="flex overflow-x-auto pb-2 space-x-2 custom-scrollbar scrollbar-hide">
                  {isGeneratingSuggestions ? (
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-32 h-8 bg-zinc-800 rounded-full animate-pulse border border-zinc-700"></div>
                    ))
                  ) : suggestedPrompts.length > 0 ? (
                    suggestedPrompts.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => applySuggestedPrompt(style.prompt)}
                        className="flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 hover:border-indigo-500/50 hover:bg-zinc-700 transition-all group"
                      >
                        <i className={`fa-solid ${style.icon} text-[10px] text-zinc-500 group-hover:text-indigo-400`}></i>
                        <span className="text-[11px] font-medium whitespace-nowrap">{style.label}</span>
                      </button>
                    ))
                  ) : !isGeneratingSuggestions && (
                    <p className="text-[11px] text-zinc-600">No suggestions available.</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center">
                  <i className="fa-solid fa-terminal mr-2 text-indigo-500"></i>
                  Transformation Prompt
                </label>
                <button 
                  onClick={() => setPrompt(INITIAL_PROMPT)}
                  className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
                >
                  Reset to default
                </button>
              </div>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the styling, mood, or edits..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder-zinc-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none outline-none leading-relaxed"
              />
              {imageState.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start space-x-3">
                  <i className="fa-solid fa-circle-exclamation text-red-500 mt-1"></i>
                  <p className="text-sm text-red-400">{imageState.error}</p>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*"
                />
                <Button 
                  variant="secondary" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageState.isProcessing}
                >
                  Change Photo
                </Button>
                <Button 
                  onClick={handleEdit} 
                  disabled={!imageState.originalUrl || !prompt || imageState.isProcessing}
                  isLoading={imageState.isProcessing}
                  icon={<i className="fa-solid fa-sparkles"></i>}
                  className="min-w-[140px]"
                >
                  Process Edit
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: History & Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full max-h-[800px]">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h2 className="font-semibold flex items-center">
                <i className="fa-solid fa-clock-rotate-left mr-2 text-zinc-500"></i>
                History
              </h2>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{history.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-3 opacity-20">
                    <i className="fa-solid fa-history text-2xl"></i>
                  </div>
                  <p className="text-zinc-600 text-sm">No recent edits.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="group relative bg-zinc-950 rounded-xl border border-zinc-800 p-3 hover:border-zinc-700 transition-all cursor-pointer">
                    <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-zinc-900">
                      <img src={item.url} alt="History thumbnail" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed mb-2">
                      {item.prompt}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setImageState(s => ({...s, editedUrl: item.url}))}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title="View"
                        >
                          <i className="fa-solid fa-eye text-[10px]"></i>
                        </button>
                        <button 
                          onClick={() => downloadImage(item.url)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          title="Download"
                        >
                          <i className="fa-solid fa-download text-[10px]"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 bg-zinc-950/50 border-t border-zinc-800">
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-tighter mb-1">Dual Model Pipeline</h4>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  Gemini 3 Flash analyzes your image for trends, and Gemini 2.5 Flash renders the masterpiece.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900">
        <div className="container mx-auto px-4 text-center">
          <p className="text-zinc-600 text-sm">
            Powered by Google Gemini &bull; Intelligent Stylization Engine
          </p>
        </div>
      </footer>
    </div>
  );
}

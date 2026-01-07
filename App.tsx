
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check for API Key on mount
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
    if (file) {
      processImageSource(file);
    }
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

    if (source instanceof File) {
      reader.readAsDataURL(source);
    } else {
      // If it's already a base64 string from camera
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
    try {
      const suggestions = await generateSuggestedPrompts(base64);
      setSuggestedPrompts(suggestions);
    } catch (err) {
      console.error("Prompt generation failed", err);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setIsCameraActive(false);
      setImageState(prev => ({ ...prev, error: "Camera access denied. Please check your permissions." }));
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      
      // Stop stream
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      
      setIsCameraActive(false);
      processImageSource(dataUrl);
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
    setImageState({ originalUrl: '', isProcessing: false, showComparison: false });
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
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-[4/3] md:aspect-[16/10] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex items-center justify-center group shadow-2xl">
            {isCameraActive ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-8 flex space-x-4">
                  <Button onClick={capturePhoto} variant="primary" icon={<i className="fa-solid fa-camera"></i>}>Capture Photo</Button>
                  <Button onClick={() => setIsCameraActive(false)} variant="secondary">Cancel</Button>
                </div>
              </div>
            ) : !imageState.originalUrl ? (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700 shadow-inner">
                  <i className="fa-solid fa-image text-zinc-500 text-3xl"></i>
                </div>
                <h3 className="text-lg font-medium mb-2">Upload or capture an image</h3>
                <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">
                  Select a photo or use your camera to start stylizing with AI.
                </p>
                <div className="flex justify-center space-x-3">
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    icon={<i className="fa-solid fa-cloud-arrow-up"></i>}
                  >
                    Choose File
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={startCamera}
                    icon={<i className="fa-solid fa-camera"></i>}
                  >
                    Use Camera
                  </Button>
                </div>
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
                    <p className="text-indigo-400 font-medium animate-pulse">Lumina is processing...</p>
                  </div>
                )}

                {imageState.editedUrl && !imageState.isProcessing && (
                  <div className="absolute bottom-4 left-4 flex space-x-2">
                    <span className="bg-indigo-600 text-[10px] uppercase font-bold px-2 py-1 rounded shadow-lg">
                      Generated Result
                    </span>
                    <button 
                      onMouseDown={() => setImageState(s => ({...s, showComparison: true}))}
                      onMouseUp={() => setImageState(s => ({...s, showComparison: false}))}
                      onTouchStart={() => setImageState(s => ({...s, showComparison: true}))}
                      onTouchEnd={() => setImageState(s => ({...s, showComparison: false}))}
                      className="bg-zinc-800 text-[10px] uppercase font-bold px-2 py-1 rounded shadow-lg active:bg-zinc-700 select-none"
                    >
                      Compare
                    </button>
                  </div>
                )}
                
                {imageState.showComparison && imageState.editedUrl && (
                   <img 
                    src={imageState.originalUrl} 
                    alt="Original comparison"
                    className="absolute inset-0 w-full h-full object-contain z-10"
                  />
                )}
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            {imageState.originalUrl && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-wand-magic text-indigo-400 text-xs"></i>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Suggested Styles</h3>
                  </div>
                  {isGeneratingSuggestions && (
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-500 animate-pulse">
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Thinking...</span>
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
                    <p className="text-[11px] text-zinc-600 italic">No suggestions available.</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center">
                  <i className="fa-solid fa-terminal mr-2 text-indigo-500"></i>
                  Edit Prompt
                </label>
                <button 
                  onClick={() => setPrompt(INITIAL_PROMPT)}
                  className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors"
                >
                  Reset
                </button>
              </div>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your transformation..."
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
                  Change
                </Button>
                <Button 
                  onClick={handleEdit} 
                  disabled={!imageState.originalUrl || !prompt || imageState.isProcessing}
                  isLoading={imageState.isProcessing}
                  icon={<i className="fa-solid fa-sparkles"></i>}
                  className="min-w-[140px]"
                >
                  Apply AI Edit
                </Button>
              </div>
            </div>
          </div>
        </div>

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
                        >
                          <i className="fa-solid fa-eye text-[10px]"></i>
                        </button>
                        <button 
                          onClick={() => downloadImage(item.url)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
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
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-tighter mb-1">System Health</h4>
                <p className="text-[10px] text-zinc-500 leading-tight">
                  {process.env.API_KEY ? "Gemini Models are ready to process your request." : "Disconnected: No API Key detected."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-zinc-900">
        <div className="container mx-auto px-4 text-center">
          <p className="text-zinc-600 text-sm">
            Powered by Google Gemini &bull; Real-time AI Vision Edit
          </p>
        </div>
      </footer>
    </div>
  );
}

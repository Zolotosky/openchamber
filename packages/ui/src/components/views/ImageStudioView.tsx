import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RiMagicLine, RiImageLine, RiHistoryLine, RiUploadCloud2Line, RiCloseLine, 
  RiSettings4Line, RiSparkling2Line, RiStackLine,
  RiComputerLine, RiLoader4Line
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// --- Types ---

interface ModelData {
  filename: string;
  display_name: string;
  type: 'SD1.5' | 'SDXL' | 'Flux';
  nsfw_level: number;
  engine: 'forge' | 'a1111' | 'both';
  description: string;
  sampler: string;
  steps: number;
  cfg_scale: number;
  width: number;
  height: number;
  negative_prompt: string;
  recommended_loras: string[];
  tags: string[];
}

interface GenerationResult {
  images: string[];
  parameters: any;
  info: string;
}

interface HistoryItem {
  id: string;
  image: string;
  timestamp: number;
  modelName: string;
  duration: number;
}

// --- Helper Components ---

// Using simplified badge styles compatible with the new theme system
// Re-implementing Badge locally to match requested style overrides if needed, or use consistent theme
const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default'|'outline'|'destructive'|'secondary', className?: string }) => {
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/80 border-transparent',
    outline: 'text-foreground border-border',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80 border-transparent',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent'
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Main View ---

export function ImageStudioView() {
  // State
  const [modelsDb, setModelsDb] = useState<ModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedModelData, setSelectedModelData] = useState<ModelData | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string>('');
  
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(768);
  const [sampler, setSampler] = useState('DPM++ 2M Karras');
  const [seed, setSeed] = useState(-1);
  const [batchSize, setBatchSize] = useState(1);
  
  const [engine, setEngine] = useState<'a1111' | 'forge'>('forge');
  const [isArtistMode, setIsArtistMode] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [generationTime, setGenerationTime] = useState<number>(0);
  
  // Img2Img State
  const [mode, setMode] = useState<'txt2img' | 'img2img'>('txt2img');
  const [initImage, setInitImage] = useState<string | null>(null);
  const [denoisingStrength, setDenoisingStrength] = useState(0.75);

  // Filter State
  const [typeFilter, setTypeFilter] = useState<'all' | 'Flux' | 'SDXL' | 'SD1.5'>('all');
  const [showNsfw, setShowNsfw] = useState(false);
  const [filteredModels, setFilteredModels] = useState<ModelData[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch models on mount
  useEffect(() => {
    fetch('/api/image-studio/models-db')
      .then(res => res.json())
      .then(data => {
        setModelsDb(data);
        setFilteredModels(data.filter((m: ModelData) => m.nsfw_level < 2)); // Initial filter
      })
      .catch(err => {
        console.error('Failed to load models:', err);
        toast.error('Failed to load models database');
      });
  }, []);

  // Filter logic
  useEffect(() => {
    let filtered = modelsDb;
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(m => m.type === typeFilter);
    }
    
    if (!showNsfw) {
      filtered = filtered.filter(m => m.nsfw_level < 2);
    }
    
    setFilteredModels(filtered);
  }, [typeFilter, showNsfw, modelsDb]);

  // Model selection handler
  const handleSelectModel = (model: ModelData) => {
    setSelectedModel(model.filename);
    setSelectedModelData(model);
    setSelectedModelName(model.display_name);
    
    // Auto-fill settings
    setSteps(model.steps);
    setCfgScale(model.cfg_scale);
    setWidth(model.width);
    setHeight(model.height);
    setSampler(model.sampler);
    setNegativePrompt(model.negative_prompt);
    
    // Set engine
    if (model.engine !== 'both') {
      setEngine(model.engine);
    } else {
      // Keep current if both
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !initImage) {
      toast.error("Please enter a prompt or upload an image.");
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();
    
    try {
      let finalPrompt = prompt;
      let finalNegativePrompt = negativePrompt;
      let finalSteps = steps;
      let finalCfg = cfgScale;
      let finalWidth = width;
      let finalHeight = height;
      let finalSampler = sampler;
      let finalModel = selectedModel;

      // 1. Artist Mode Processing
      if (isArtistMode) {
        try {
          const artistRes = await fetch('/api/image-studio/artist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: prompt,
              availableModels: [], 
              mode
            })
          });
          
          if (artistRes.ok) {
            const artistData = await artistRes.json();
            finalPrompt = artistData.prompt;
            finalNegativePrompt = artistData.negative_prompt || negativePrompt;
            finalSteps = artistData.steps || steps;
            finalCfg = artistData.cfg_scale || cfgScale;
            finalWidth = artistData.width || width;
            finalHeight = artistData.height || height;
            finalSampler = artistData.sampler_name || sampler;
            
            if (!selectedModel && artistData.model) {
              finalModel = artistData.model;
              const mData = modelsDb.find(m => m.filename === artistData.model);
              if (mData) {
                setSelectedModelName(mData.display_name);
              }
            }
            
            toast.success("Artist Mode applied optimized settings");
          }
        } catch (e) {
          console.error("Artist mode failed", e);
        }
      }

      // 2. Generate
      const endpoint = mode === 'img2img' ? '/api/image-studio/img2img' : '/api/image-studio/generate';
      const payload: any = {
        prompt: finalPrompt,
        negative_prompt: finalNegativePrompt,
        steps: finalSteps,
        cfg_scale: finalCfg,
        width: finalWidth,
        height: finalHeight,
        sampler_name: finalSampler,
        seed,
        batch_size: batchSize,
        engine,
        override_model: finalModel
      };

      if (mode === 'img2img' && initImage) {
        payload.init_images = [initImage.split(',')[1]]; // Remove header
        payload.denoising_strength = denoisingStrength;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data: GenerationResult = await res.json();
      
      // Update UI
      if (data.images && data.images.length > 0) {
        const imgUrl = `data:image/png;base64,${data.images[0]}`;
        setCurrentImage(imgUrl);
        
        const duration = Date.now() - startTime;
        setGenerationTime(duration);
        
        // Add to history
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          image: imgUrl,
          timestamp: Date.now(),
          modelName: selectedModelName || 'Auto-Selected',
          duration
        };
        setHistory(prev => [newHistoryItem, ...prev].slice(0, 6));
      }

    } catch (error: any) {
      toast.error(error.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInitImage(reader.result as string);
        setMode('img2img');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setInitImage(reader.result as string);
          setMode('img2img');
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const formatDuration = (ms: number) => {
    return (ms / 1000).toFixed(1) + 's';
  };

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden font-sans">
      {/* LEFT PANEL: Gallery & Settings */}
      <div className="w-[380px] flex flex-col border-r border-border bg-background">
        
        {/* Model Gallery Header */}
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <RiStackLine className="w-5 h-5 text-primary" />
              Model Gallery
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">NSFW</span>
              <Switch checked={showNsfw} onCheckedChange={setShowNsfw} />
            </div>
          </div>
          
          <div className="flex p-1 bg-muted rounded-lg">
            {(['all', 'Flux', 'SDXL', 'SD1.5'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md transition-all font-medium",
                  typeFilter === t 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Model Grid */}
        <ScrollArea className="flex-1 px-4 py-4 h-0 bg-background">
          <div className="grid grid-cols-2 gap-3 pb-4">
            {filteredModels.map((model) => (
              <div 
                key={model.filename}
                onClick={() => handleSelectModel(model)}
                className={cn(
                  "cursor-pointer group relative flex flex-col gap-2 p-3 rounded-xl border transition-all bg-card hover:bg-accent",
                  selectedModel === model.filename 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border",
                    model.type === 'Flux' ? "bg-violet-500/15 text-violet-400 border-violet-500/20" :
                    model.type === 'SDXL' ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                    "bg-muted text-muted-foreground border-border"
                  )}>
                    {model.type}
                  </span>
                  {model.nsfw_level >= 2 && (
                    <span className="text-[10px] font-bold text-red-500">
                      {model.nsfw_level === 3 ? '18+ HARD' : '18+'}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2 text-foreground">
                    {model.display_name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">
                    {model.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Settings Panel */}
        <div className="border-t border-border bg-card p-4 space-y-5 shadow-sm z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <RiSettings4Line className="w-3.5 h-3.5" />
              Settings
            </h3>
            
            {/* Engine Selector */}
            {selectedModelData?.engine === 'both' ? (
              <div className="flex bg-muted p-0.5 rounded-md">
                <button 
                  onClick={() => setEngine('forge')}
                  className={cn("px-2 py-0.5 text-[10px] rounded transition-colors", engine === 'forge' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >Forge</button>
                <button 
                  onClick={() => setEngine('a1111')}
                  className={cn("px-2 py-0.5 text-[10px] rounded transition-colors", engine === 'a1111' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >A1111</button>
              </div>
            ) : selectedModelData && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {selectedModelData.engine === 'forge' ? 'Forge' : 'A1111'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Width</label>
                <Input 
                  type="number" 
                  value={width} 
                  onChange={(e) => setWidth(Number(e.target.value))}
                  step={64}
                  className="h-8 bg-background border-border text-xs"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Height</label>
                <Input 
                  type="number" 
                  value={height} 
                  onChange={(e) => setHeight(Number(e.target.value))}
                  step={64}
                  className="h-8 bg-background border-border text-xs"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Steps ({steps})</label>
                <Slider 
                  value={steps} 
                  onChange={(v) => setSteps(v)}
                  max={100} 
                  step={1}
                  className="py-1"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs text-muted-foreground">CFG Scale ({cfgScale})</label>
                <Slider 
                  value={cfgScale} 
                  onChange={(v) => setCfgScale(v)}
                  max={20} 
                  step={0.5}
                  className="py-1"
                />
             </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Sampler</label>
            <Select value={sampler} onValueChange={setSampler}>
              <SelectTrigger className="h-8 bg-background border-border text-xs w-full">
                <SelectValue placeholder="Select sampler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DPM++ 2M Karras">DPM++ 2M Karras</SelectItem>
                <SelectItem value="DPM++ SDE Karras">DPM++ SDE Karras</SelectItem>
                <SelectItem value="Euler a">Euler a</SelectItem>
                <SelectItem value="Euler">Euler</SelectItem>
                <SelectItem value="DDIM">DDIM</SelectItem>
                <SelectItem value="UniPC">UniPC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Negative Prompt</label>
            <Textarea 
              value={negativePrompt} 
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="min-h-[60px] max-h-[100px] bg-background border-border text-xs resize-none placeholder:text-muted-foreground/50"
              placeholder="Low quality, ugly..."
            />
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Generation */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Top Bar: Prompt & Actions */}
        <div className="p-6 space-y-4 z-10 relative">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your imagination..."
                className="min-h-[100px] text-base bg-background border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none rounded-xl p-4 shadow-sm text-foreground placeholder:text-muted-foreground"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-2 py-1 border border-border shadow-sm">
                  <RiSparkling2Line className={cn("w-3.5 h-3.5", isArtistMode ? "text-indigo-400" : "text-muted-foreground")} />
                  <span className="text-[10px] font-medium text-muted-foreground">Artist Mode</span>
                  <Switch 
                    checked={isArtistMode} 
                    onCheckedChange={setIsArtistMode}
                    className="scale-75 data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 w-40">
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="h-full flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg shadow-md rounded-xl"
              >
                {isGenerating ? (
                  <div className="flex flex-col items-center gap-2">
                    <RiLoader4Line className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-normal">Generating...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <RiMagicLine className="w-6 h-6" />
                    <span>Generate</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex justify-between items-center px-1">
            <div className="flex gap-4">
              <Button 
                variant={mode === 'txt2img' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setMode('txt2img')}
                className={cn("h-8 text-xs gap-2", mode === 'txt2img' ? "bg-muted text-foreground" : "text-muted-foreground")}
              >
                <RiImageLine className="w-3.5 h-3.5" /> txt2img
              </Button>
              <Button 
                variant={mode === 'img2img' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setMode('img2img')}
                className={cn("h-8 text-xs gap-2", mode === 'img2img' ? "bg-muted text-foreground" : "text-muted-foreground")}
              >
                <RiUploadCloud2Line className="w-3.5 h-3.5" /> img2img
              </Button>
            </div>
            
            <div className="text-xs font-mono text-muted-foreground">
              {selectedModelName || 'No Model Selected'}
            </div>
          </div>
          
          {/* Img2Img Area */}
          {mode === 'img2img' && (
            <div 
              className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/30 flex items-center gap-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className="w-20 h-20 bg-muted rounded flex items-center justify-center shrink-0 border border-border overflow-hidden relative">
                {initImage ? (
                   <img src={initImage} alt="Init" className="w-full h-full object-cover" />
                ) : (
                   <RiUploadCloud2Line className="w-6 h-6 text-muted-foreground" />
                )}
                {initImage && (
                  <button 
                    onClick={() => setInitImage(null)}
                    className="absolute top-0 right-0 p-1 bg-background/80 hover:bg-destructive text-foreground hover:text-destructive-foreground transition-colors"
                  >
                    <RiCloseLine className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Denoising Strength</span>
                  <span>{denoisingStrength}</span>
                </div>
                <Slider 
                  value={denoisingStrength} 
                  onChange={(v) => setDenoisingStrength(v)}
                  max={1} 
                  step={0.05}
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleImageUpload} 
                  accept="image/*"
                />
                {!initImage && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7 border-border bg-background hover:bg-accent"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Image
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Display Area */}
        <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden bg-muted/10">
           {currentImage ? (
             <div className="relative group max-h-full shadow-2xl rounded-2xl overflow-hidden ring-1 ring-border bg-background">
               <img 
                 src={currentImage} 
                 alt="Generated" 
                 className="max-h-[calc(100vh-320px)] object-contain rounded-2xl"
               />
               <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="flex justify-between items-end text-xs text-white font-mono">
                   <span>{width}x{height}</span>
                   <span>{formatDuration(generationTime)}</span>
                 </div>
               </div>
             </div>
           ) : (
             <div className="text-center text-muted-foreground space-y-4 border-2 border-dashed border-border rounded-2xl p-12">
               <div className="w-24 h-24 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                 <RiComputerLine className="w-8 h-8 opacity-50" />
               </div>
               <p className="text-sm font-medium text-foreground">Ready to create</p>
               <p className="text-xs max-w-xs mx-auto">Select a model from the gallery and describe your vision.</p>
             </div>
           )}
        </div>

        {/* History Strip */}
        <div className="h-32 border-t border-border bg-background p-4">
          <div className="flex gap-3 h-full overflow-x-auto pb-2 scrollbar-hide">
             {history.map((item) => (
               <div 
                 key={item.id}
                 onClick={() => setCurrentImage(item.image)}
                 className={cn(
                   "w-16 h-16 shrink-0 rounded-lg overflow-hidden border cursor-pointer relative group transition-all hover:scale-105",
                   currentImage === item.image ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                 )}
               >
                 <img src={item.image} alt="History" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
               </div>
             ))}
             {history.length === 0 && (
               <div className="flex items-center justify-center w-full text-xs text-muted-foreground italic">
                 Recent creations will appear here
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

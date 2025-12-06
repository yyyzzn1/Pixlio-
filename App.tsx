
import React, { useState, useEffect, useRef } from 'react';
import { 
  GeneratedMedia, 
  GenerationType 
} from './types';
import { 
  generateImage, 
  generateImagesParallel,
  generateVideo, 
  extendVideo,
  generateSoundEffect,
  pcmToWav
} from './services/geminiService';
import { 
  Sparkles, 
  Lock, 
  LockOpen, 
  Video, 
  Music, 
  Image as ImageIcon,
  Loader2,
  Download,
  Play,
  Trash2,
  Clock,
  ArrowRight,
  CheckCircle2,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Palette,
  Film,
  Zap,
  Plus,
  Share2,
  Move,
  Wind,
  ZoomIn,
  Camera
} from 'lucide-react';

const STYLES = [
  { id: 'realistic', label: 'واقعي', prompt: 'realistic, highly detailed, 8k, photorealistic' },
  { id: 'anime', label: 'أنمي', prompt: 'anime style, studio ghibli, vibrant colors' },
  { id: '3d', label: '3D', prompt: '3d render, pixar style, c4d, unreal engine' },
  { id: 'oil', label: 'زيتي', prompt: 'oil painting, textured, artistic, classic' },
  { id: 'cinematic', label: 'سينمائي', prompt: 'cinematic lighting, movie scene, dramatic' },
  { id: 'pixel', label: 'بكسل', prompt: 'pixel art, 16-bit, retro game style' },
  { id: 'fantasy', label: 'خيالي', prompt: 'fantasy art, magical, ethereal, dreamlike' },
];

const MOTION_TYPES = [
    { id: 'pan', label: 'تحريك الكاميرا (Pan)', icon: <Camera size={14} />, prompt: 'slow camera pan, cinematic movement' },
    { id: 'zoom', label: 'تقريب (Zoom)', icon: <ZoomIn size={14} />, prompt: 'slow zoom in, dramatic close up' },
    { id: 'wind', label: 'رياح/تطاير', icon: <Wind size={14} />, prompt: 'hair blowing in wind, clothes moving, flowing atmosphere' },
    { id: 'walk', label: 'مشي/حركة', icon: <Move size={14} />, prompt: 'character walking, active movement, dynamic' },
];

const App: React.FC = () => {
  // State
  const [prompt, setPrompt] = useState('');
  const [mediaList, setMediaList] = useState<GeneratedMedia[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // New Generation Flow State
  const [candidates, setCandidates] = useState<Array<{ url: string; seed: number; saved?: boolean }>>([]);
  const [viewMode, setViewMode] = useState<'create' | 'select' | 'edit'>('create');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Consistency / Seed State
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [isLocked, setIsLocked] = useState(false);

  // Configuration
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('realistic');

  // Animation Modal State
  const [showAnimateModal, setShowAnimateModal] = useState(false);
  const [animationPrompt, setAnimationPrompt] = useState('');
  const [selectedMotionType, setSelectedMotionType] = useState<string | null>(null);

  const selectedMedia = mediaList.find(m => m.id === selectedId);

  // Video Ref for Sync
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sync Audio with Video play/pause
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video && audio) {
      const onPlay = () => audio.play().catch(e => console.log("Audio play failed interaction", e));
      const onPause = () => audio.pause();
      const onSeek = () => { audio.currentTime = video.currentTime; };
      const onEnded = () => { audio.currentTime = 0; audio.pause(); };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeking', onSeek);
      video.addEventListener('ended', onEnded);
      
      // Attempt loop sync
      video.loop = true;
      audio.loop = true;

      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeking', onSeek);
        video.removeEventListener('ended', onEnded);
      };
    }
  }, [selectedId, selectedMedia]);

  // Handlers
  const handleGenerateCandidates = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setLoadingMessage('جاري تصميم نسختين من الصورة...');
    
    try {
      const seedToUse = isLocked ? seed : undefined;
      const style = STYLES.find(s => s.id === selectedStyleId);
      const fullPrompt = style ? `${prompt}, ${style.prompt}` : prompt;

      const results = await generateImagesParallel(fullPrompt, seedToUse, aspectRatio);
      
      setCandidates(results.map(r => ({...r, saved: false})));
      setViewMode('select');
      setSelectedId(null); // Deselect current so user focuses on choice
      
      if (!isLocked && results.length > 0) {
          setSeed(results[0].seed);
      }

    } catch (error: any) {
      console.error(error);
      alert('حدث خطأ أثناء التوليد: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSaveCandidate = (index: number) => {
      const candidate = candidates[index];
      if (candidate.saved) return;

      const newMedia: GeneratedMedia = {
        id: crypto.randomUUID(),
        type: 'image',
        url: candidate.url,
        prompt: prompt,
        seed: candidate.seed,
        aspectRatio: aspectRatio,
        timestamp: Date.now()
      };

      setMediaList(prev => [newMedia, ...prev]);
      
      // Mark as saved UI
      const newCandidates = [...candidates];
      newCandidates[index].saved = true;
      setCandidates(newCandidates);
  };

  const handleEditImage = async () => {
    if (!selectedMedia || selectedMedia.type !== 'image' || !prompt.trim()) return;

    setIsLoading(true);
    setLoadingMessage('جاري تعديل الصورة...');

    try {
       const style = STYLES.find(s => s.id === selectedStyleId);
       const fullPrompt = style ? `${prompt}, ${style.prompt}` : prompt;

       const result = await generateImage(fullPrompt, isLocked ? seed : undefined, selectedMedia.url, selectedMedia.aspectRatio || aspectRatio);

       const newMedia: GeneratedMedia = {
        id: crypto.randomUUID(),
        type: 'image',
        url: result.url,
        prompt: prompt,
        seed: result.seed,
        aspectRatio: selectedMedia.aspectRatio || aspectRatio,
        timestamp: Date.now()
      };

      setMediaList(prev => [newMedia, ...prev]);
      setSelectedId(newMedia.id);
      setSeed(result.seed);
    } catch (error: any) {
      console.error(error);
      alert('فشل التعديل: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessMedia = async () => {
    // Determine if we are creating a video from image OR extending a video
    if (!selectedMedia || !animationPrompt.trim()) return;
    
    setShowAnimateModal(false);
    setIsLoading(true);

    const isVideoExtension = selectedMedia.type === 'video';

    if (isVideoExtension) {
        setLoadingMessage('جاري تمديد الفيديو... يرجى الانتظار دقيقة لضمان الجودة.');
    } else {
        setLoadingMessage(`جاري تحويل الصورة إلى فيديو... يتم إضافة حركة سينمائية...`);
    }

    try {
      let videoResult;
      
      // Construct robust prompt
      const motion = MOTION_TYPES.find(m => m.id === selectedMotionType);
      let fullAnimationPrompt = animationPrompt;
      if (motion) {
          fullAnimationPrompt = `${motion.prompt}, ${animationPrompt}`;
      }
      
      if (isVideoExtension) {
          // Extend existing video
          // Strict error handling for missing handle
          if (!selectedMedia.veoHandle) {
             throw new Error("لا يمكن تمديد هذا الفيديو لأنه تم إنشاؤه بنسخة قديمة أو غير متوافقة.");
          }
          videoResult = await extendVideo(
             fullAnimationPrompt, 
             selectedMedia.veoHandle,
             selectedMedia.aspectRatio || '16:9'
          );
      } else if (selectedMedia.type === 'image') {
          // New video from image
          videoResult = await generateVideo(
              fullAnimationPrompt, 
              selectedMedia.url,
              selectedMedia.aspectRatio || '16:9'
          );
      } else {
          throw new Error("Cannot animate this media type");
      }
      
      // Generate Sound
      let audioUrl;
      try {
        const soundPromise = generateSoundEffect(animationPrompt + " cinematic sound effects, ambience");
        const audioPcm = await soundPromise;
        audioUrl = pcmToWav(audioPcm);
      } catch (e) {
          console.warn("Audio generation failed but video succeeded", e);
      }
      
      const newMedia: GeneratedMedia = {
        id: crypto.randomUUID(),
        type: 'video',
        url: videoResult.url,
        audioUrl: audioUrl,
        prompt: fullAnimationPrompt,
        baseImage: selectedMedia.type === 'image' ? selectedMedia.url : selectedMedia.baseImage,
        veoHandle: videoResult.videoMetadata, // Save handle for further extension
        aspectRatio: videoResult.aspectRatio,
        timestamp: Date.now()
      };

      setMediaList(prev => [newMedia, ...prev]);
      setSelectedId(newMedia.id);
      setViewMode('edit');

    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes('SelectKey')) {
         // Handled internally, user cancelled or failed selection
      } else {
         alert('عذراً، حدث خطأ أثناء إنشاء الفيديو: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedMedia) return;
    
    try {
        const link = document.createElement('a');
        link.href = selectedMedia.url;
        link.download = `creative-studio-${selectedMedia.id}.${selectedMedia.type === 'video' ? 'mp4' : 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (selectedMedia.type === 'video' && selectedMedia.audioUrl) {
            setTimeout(() => {
                const audioLink = document.createElement('a');
                audioLink.href = selectedMedia.audioUrl!;
                audioLink.download = `creative-studio-${selectedMedia.id}-audio.wav`;
                document.body.appendChild(audioLink);
                audioLink.click();
                document.body.removeChild(audioLink);
            }, 500);
        }
    } catch (e) {
        console.error("Download failed", e);
        window.open(selectedMedia.url, '_blank');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('تم نسخ رابط الاستوديو الخاص بك!');
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  // Helper to switch to edit mode when clicking top bar
  const selectFromGallery = (id: string) => {
    setSelectedId(id);
    setViewMode('edit');
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* Top Gallery ("Pictures Above") */}
      <div className="h-24 md:h-28 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center px-4 gap-3 shrink-0 z-20 overflow-x-auto no-scrollbar">
        <div 
          onClick={() => { setViewMode('create'); setSelectedId(null); setCandidates([]); }}
          className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300 border ${viewMode === 'create' ? 'bg-gradient-to-tr from-purple-600 to-blue-600 border-transparent text-white shadow-lg shadow-purple-900/40' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
          title="إنشاء جديد"
        >
          <Sparkles size={20} />
        </div>
        
        <div className="h-8 w-[1px] bg-white/10 mx-1"></div>

        {mediaList.map(item => (
          <div 
            key={item.id}
            onClick={() => selectFromGallery(item.id)}
            className={`flex-shrink-0 relative cursor-pointer rounded-xl overflow-hidden h-16 md:h-20 transition-all duration-300 ${selectedId === item.id ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-black w-auto aspect-auto opacity-100' : 'opacity-60 hover:opacity-100 hover:scale-105 grayscale hover:grayscale-0'} `}
          >
            {item.type === 'image' && (
              <img src={item.url} alt="thumbnail" className="h-full w-auto object-cover min-w-[3rem]" />
            )}
            {item.type === 'video' && (
              <div className="h-full w-24 bg-zinc-900 flex items-center justify-center relative border border-white/5">
                 <video src={item.url} className="h-full w-full object-cover opacity-80" />
                 <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                   <Video className="text-white w-6 h-6 drop-shadow-md" />
                 </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center p-6">
          
          {/* Subtle Background Elements */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>

          {/* VIEW: SELECT (Split Screen) */}
          {viewMode === 'select' && candidates.length > 0 && (
             <div className="w-full max-w-5xl h-full flex flex-col animate-in fade-in zoom-in duration-300">
                <h2 className="text-center text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-300">
                  اختر الصور التي تريد الاحتفاظ بها
                </h2>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 pb-8">
                   {candidates.map((cand, idx) => (
                      <div 
                        key={idx} 
                        className="group relative border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-900/20 bg-zinc-900/50 flex flex-col"
                      >
                         <div className="flex-1 flex items-center justify-center p-4">
                             <img src={cand.url} alt={`Option ${idx+1}`} className="max-w-full max-h-full object-contain rounded-lg" />
                         </div>
                         <div className={`absolute inset-0 bg-black/60 transition-opacity flex items-center justify-center backdrop-blur-[2px] ${cand.saved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {cand.saved ? (
                                <div className="bg-green-500/20 text-green-300 px-6 py-3 rounded-full font-bold flex items-center gap-2 border border-green-500/50">
                                    <CheckCircle2 size={20} />
                                    تم الحفظ في الشريط العلوي
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleSaveCandidate(idx)}
                                    className="bg-white text-black px-8 py-3 rounded-full font-bold shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform hover:bg-purple-50 flex items-center gap-2"
                                >
                                    <Plus size={20} />
                                    حفظ في الاستوديو
                                </button>
                            )}
                         </div>
                      </div>
                   ))}
                </div>
                <p className="text-center text-white/40 mb-4">
                    بعد الحفظ، اختر أي صورة من الشريط العلوي للبدء في تحريكها
                </p>
             </div>
          )}

          {/* VIEW: CREATE (Empty State) */}
          {viewMode === 'create' && candidates.length === 0 && (
            <div className="text-center text-white/40 flex flex-col items-center max-w-md p-10 border border-dashed border-white/10 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white/5 backdrop-blur-sm">
              <Zap className="w-12 h-12 mb-4 text-purple-500" />
              <h2 className="text-2xl font-bold text-white mb-2">استوديو الإبداع</h2>
              <p className="text-sm leading-relaxed text-white/60">
                اكتب وصفاً، وسنقوم بتوليد نسختين. احفظ ما يعجبك في الشريط العلوي، ثم اختر أي صورة لتحويلها إلى فيديو.
              </p>
            </div>
          )}

          {/* VIEW: EDIT (Single Media) */}
          {viewMode === 'edit' && selectedMedia && (
            <div className="relative w-full h-full flex items-center justify-center animate-in fade-in duration-300">
              
              {selectedMedia.type === 'image' && (
                <img src={selectedMedia.url} alt="Main" className="max-w-full max-h-[70vh] object-contain shadow-2xl shadow-black/50 rounded-lg border border-white/5" />
              )}
              
              {selectedMedia.type === 'video' && (
                <div className="relative max-w-full max-h-[70vh] shadow-2xl rounded-lg overflow-hidden bg-black flex items-center justify-center border border-white/10">
                    <video 
                        ref={videoRef}
                        controls 
                        autoPlay
                        loop
                        className="max-h-[70vh] max-w-full"
                        src={selectedMedia.url}
                    />
                    {selectedMedia.audioUrl && (
                        <audio ref={audioRef} src={selectedMedia.audioUrl} className="hidden" />
                    )}
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl rounded-full px-3 py-1.5 flex items-center gap-2 text-xs text-green-300 border border-green-500/20 shadow-lg">
                         <div className="flex gap-0.5 items-end h-3">
                            <div className="w-0.5 h-full bg-green-400 animate-[music-bar_0.5s_ease-in-out_infinite]"></div>
                            <div className="w-0.5 h-2 bg-green-400 animate-[music-bar_0.7s_ease-in-out_infinite]"></div>
                            <div className="w-0.5 h-3 bg-green-400 animate-[music-bar_0.4s_ease-in-out_infinite]"></div>
                         </div>
                        <span>AI Audio</span>
                    </div>
                </div>
              )}

              {/* Info Overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-6 bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-white/10 max-w-sm shadow-2xl flex gap-4 items-center w-[90%] md:w-auto z-20">
                 <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{selectedMedia.prompt}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                      <span>{selectedMedia.type === 'image' ? 'Image' : 'Video'}</span>
                      {selectedMedia.seed && <span>• Seed: {selectedMedia.seed}</span>}
                    </div>
                 </div>
                 <button 
                   onClick={handleDownload}
                   className="p-3 bg-white hover:bg-white/90 rounded-xl text-black transition-colors font-bold flex items-center gap-2 shadow-lg"
                   title="تحميل"
                 >
                   <Download size={18} />
                   <span className="text-xs hidden sm:inline">تحميل</span>
                 </button>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
              <div className="relative mb-6">
                 <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-blue-500 blur-3xl opacity-30 rounded-full animate-pulse"></div>
                 <Loader2 className="w-12 h-12 text-white animate-spin relative z-10" />
              </div>
              <p className="text-lg font-light tracking-wide text-white/90 animate-pulse text-center max-w-md px-4">{loadingMessage}</p>
            </div>
          )}
        </div>

        {/* Action Bar (Bottom) */}
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 md:px-8 md:py-6 z-30">
          <div className="max-w-6xl mx-auto flex flex-col gap-4">
            
            {/* Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              
               {/* Style & Aspect Ratio Group */}
               <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                  
                  {/* Aspect Ratio */}
                  <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5 shrink-0">
                    <button
                      onClick={() => setAspectRatio('1:1')}
                      className={`p-1.5 rounded-lg transition-all ${aspectRatio === '1:1' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                      title="مربع 1:1"
                    >
                      <Square size={16} />
                    </button>
                    <button
                      onClick={() => setAspectRatio('9:16')}
                      className={`p-1.5 rounded-lg transition-all ${aspectRatio === '9:16' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                      title="طولي 9:16 (Story)"
                    >
                      <RectangleVertical size={16} />
                    </button>
                    <button
                      onClick={() => setAspectRatio('16:9')}
                      className={`p-1.5 rounded-lg transition-all ${aspectRatio === '16:9' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                      title="عرضي 16:9 (Youtube)"
                    >
                      <RectangleHorizontal size={16} />
                    </button>
                  </div>

                  {/* Styles */}
                  <div className="h-6 w-[1px] bg-white/10"></div>
                  
                  <div className="flex items-center gap-2">
                     {STYLES.map(style => (
                        <button
                            key={style.id}
                            onClick={() => setSelectedStyleId(style.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                                selectedStyleId === style.id 
                                ? 'bg-purple-600/20 text-purple-300 border-purple-500/50' 
                                : 'bg-transparent text-white/40 border-transparent hover:bg-white/5 hover:text-white/70'
                            }`}
                        >
                            {style.label}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Right Side Buttons */}
               <div className="flex items-center gap-2 ml-auto">
                 <button 
                    onClick={handleShare}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
                    title="مشاركة الرابط"
                 >
                    <Share2 size={14} />
                    <span className="hidden md:inline">مشاركة</span>
                 </button>

                 <button 
                    onClick={toggleLock}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isLocked 
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                        : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'
                    }`}
                  >
                    {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                    <span className="font-mono hidden md:inline">{seed ? seed.toString().slice(0, 4) : 'SEED'}</span>
                  </button>

                  {/* Context Sensitive Animate Button */}
                  {viewMode === 'edit' && selectedMedia && (
                      <button
                      onClick={() => { setAnimationPrompt(''); setSelectedMotionType(null); setShowAnimateModal(true); }}
                      className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white border-none shadow-lg transition-all transform hover:scale-105 ${
                        selectedMedia.type === 'video' 
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-900/20'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20'
                      }`}
                      >
                      {selectedMedia.type === 'video' ? <Film size={16} /> : <Video size={16} />}
                      <span className="text-sm font-bold">{selectedMedia.type === 'video' ? 'تكملة الفيديو' : 'تحريك'}</span>
                      </button>
                  )}
               </div>
            </div>

            {/* Input Field */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition-opacity duration-500"></div>
              <div className="relative flex items-center bg-[#0a0a0a] rounded-2xl border border-white/10 overflow-hidden shadow-inner">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (viewMode === 'edit' && selectedMedia?.type === 'image' ? handleEditImage() : handleGenerateCandidates())}
                    placeholder={
                        viewMode === 'edit' && selectedMedia?.type === 'image' 
                        ? "أضف تعديلات (مثلاً: غير لون الشعر، أضف نظارة...)" 
                        : "اكتب وصفاً للصورة... (مثال: قطة تعزف الغيتار تحت المطر)"
                    }
                    className="flex-1 bg-transparent px-6 py-4 text-white placeholder-white/30 focus:outline-none text-right text-lg font-medium"
                    dir="rtl"
                />
                <button
                    onClick={viewMode === 'edit' && selectedMedia?.type === 'image' ? handleEditImage : handleGenerateCandidates}
                    disabled={isLoading || !prompt.trim()}
                    className="bg-white text-black p-3 m-1.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-purple-100 hover:scale-95 active:scale-90"
                >
                    {viewMode === 'edit' && selectedMedia?.type === 'image' ? <Sparkles size={20} /> : <ArrowRight size={20} className="rotate-180" />}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Animation / Extension Modal */}
      {showAnimateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative overflow-hidden">
             {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white relative z-10">
              <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                {selectedMedia?.type === 'video' ? <Film className="text-blue-400" size={24} /> : <Video className="text-purple-400" size={24} />}
              </div>
              {selectedMedia?.type === 'video' ? 'تكملة الفيديو' : 'صناعة فيديو'}
            </h3>
            
            <div className="space-y-6 relative z-10">
               <div>
                    <label className="block text-sm font-medium text-white/50 mb-2">
                        {selectedMedia?.type === 'video' ? 'ماذا يحدث بعد ذلك؟' : 'كيف تريد تحريك الصورة؟'}
                    </label>

                    {/* Motion Type Selectors */}
                    {!selectedMedia?.type || selectedMedia.type === 'image' ? (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {MOTION_TYPES.map(motion => (
                                <button
                                    key={motion.id}
                                    onClick={() => setSelectedMotionType(motion.id === selectedMotionType ? null : motion.id)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                                        selectedMotionType === motion.id 
                                        ? 'bg-purple-600/20 border-purple-500 text-white' 
                                        : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {motion.icon}
                                    <span>{motion.label}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}

                    <textarea 
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none h-32 text-lg transition-all"
                        placeholder={selectedMedia?.type === 'video' ? "مثلاً: الكاميرا تبتعد، الشخصية تقفز، السماء تمطر..." : "صف تفاصيل الحركة الإضافية..."}
                        value={animationPrompt}
                        onChange={(e) => setAnimationPrompt(e.target.value)}
                        dir="rtl"
                        autoFocus
                    />
               </div>
               
               {/* Note about auto-audio */}
               <div className="bg-gradient-to-r from-green-900/10 to-emerald-900/10 border border-green-500/10 rounded-2xl p-4 flex items-center gap-4">
                   <div className="bg-green-500/10 p-2 rounded-full">
                     <Music className="text-green-400 w-5 h-5" />
                   </div>
                   <div className="text-right flex-1">
                       <p className="text-sm font-bold text-green-200">هندسة صوتية ذكية</p>
                       <p className="text-xs text-green-400/50">سيتم تحليل المشهد وتوليد مؤثرات صوتية مناسبة تلقائياً.</p>
                   </div>
                   <CheckCircle2 className="text-green-500 w-5 h-5" />
               </div>
            </div>

            <div className="flex gap-4 mt-8 relative z-10">
              <button 
                onClick={() => setShowAnimateModal(false)}
                className="flex-1 py-3.5 rounded-xl text-white/50 hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all font-medium"
              >
                إلغاء
              </button>
              <button 
                onClick={handleProcessMedia}
                disabled={!animationPrompt.trim() && !selectedMotionType}
                className={`flex-1 py-3.5 rounded-xl text-white font-bold disabled:opacity-50 shadow-lg transition-all ${
                    selectedMedia?.type === 'video'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-900/20'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20'
                }`}
              >
                {selectedMedia?.type === 'video' ? 'تمديد الفيديو' : '✨ تحريك'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;

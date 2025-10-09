import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Download, Video, Sparkles, Lock, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriptionModal } from "./SubscriptionModal";
import editingExample from "@/assets/editing-example.png";
import { useMemo } from "react";

// Detect if user is on mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints && navigator.maxTouchPoints > 2;
};

// Generate unique request ID for tracking
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Language mappings (static, defined outside component)
const LANGUAGE_NAMES: Record<string, string> = {
  ky: 'Kyrgyz', kk: 'Kazakh', uz: 'Uzbek', ru: 'Russian', tr: 'Turkish',
  en: 'English', ar: 'Arabic', zh: 'Chinese', es: 'Spanish', fr: 'French',
  de: 'German', hi: 'Hindi', ja: 'Japanese', ko: 'Korean'
};

// Caption styles (static, defined outside component)
const CAPTION_STYLES = [{
  id: 'outline',
  name: 'Stroke',
  css: 'background-color: transparent; color: white; font-weight: bold; font-size: 2em; text-shadow: -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000, 4px 4px 0 #000, -4px 0 0 #000, 4px 0 0 #000, 0 -4px 0 #000, 0 4px 0 #000;',
  prompt: 'white text with extra thick black outline, no background, bold font, very high contrast'
}, {
  id: 'minimal',
  name: 'Subtle',
  css: 'background-color: rgba(0, 0, 0, 0.7); color: white; font-weight: 300; font-size: 1.3em; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8); padding: 0.3em 0.8em;',
  prompt: 'white text, light weight, semi-transparent black background, minimal shadow'
}, {
  id: 'green',
  name: 'Highlight',
  css: 'color: black; font-weight: 900; text-shadow: 0 0 6px rgba(234, 179, 8, 0.95), 0 0 14px rgba(234, 179, 8, 0.85), -2px -2px 0 #ffffff, 2px -2px 0 #ffffff, -2px 2px 0 #ffffff, 2px 2px 0 #ffffff;',
  prompt: 'black text with strong yellow glow and white outline, extra bold, highly distinct from stroke'
}, {
  id: 'boxed',
  name: 'Framed',
  css: 'background-color: rgba(0, 0, 0, 0.95); color: #00ff00; font-weight: bold; font-size: 1.6em; border: 4px solid #00ff00; text-shadow: 0 0 10px #00ff00; padding: 0.4em 0.8em;',
  prompt: 'bright green text with green border box and glow effect, bold font, solid black background'
}];

export const KyrgyzSubtitleGenerator = () => {
  const { user, subscription, refreshSubscription } = useAuth();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<string>("");
  const [editedSubtitles, setEditedSubtitles] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);
  const [parsedCues, setParsedCues] = useState<Array<{
    start: number;
    end: number;
    text: string;
  }>>([]);
  const [currentCueIndex, setCurrentCueIndex] = useState<number>(-1);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);
  const [captionStyle, setCaptionStyle] = useState<string>('outline');
  const [addEmojis, setAddEmojis] = useState<boolean>(true);
  const [correctSpelling, setCorrectSpelling] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    const saved = localStorage.getItem('preferredSubtitleLanguage');
    return saved || 'ky';
  });
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [titleVariations, setTitleVariations] = useState<string[]>([]);
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);
  const [summaries, setSummaries] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [videosProcessedCount, setVideosProcessedCount] = useState<number>(43);
  
  // Track free generations for non-authenticated users
  const [freeGenerationsUsed, setFreeGenerationsUsed] = useState(() => {
    const used = localStorage.getItem('freeGenerationsUsed');
    return used ? parseInt(used, 10) : 0;
  });
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const subtitleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ffmpegRef = useRef(new FFmpeg());
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);
  const [cloudPredictionId, setCloudPredictionId] = useState<string | null>(() => {
    return localStorage.getItem('cloudPredictionId');
  });
  const [cloudStatus, setCloudStatus] = useState<string>('');
  const [cloudPolling, setCloudPolling] = useState<boolean>(false);
  const [cloudVideoUrl, setCloudVideoUrl] = useState<string | null>(() => {
    return localStorage.getItem('cloudVideoUrl');
  });
  const [cloudStartTime, setCloudStartTime] = useState<number>(() => {
    const saved = localStorage.getItem('cloudStartTime');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [cloudElapsedTime, setCloudElapsedTime] = useState<number>(0);
  const cloudPollTokenRef = useRef(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [processorReady, setProcessorReady] = useState(false);
  
  // Memoize current style to avoid recalculation on every render
  const currentStyle = useMemo(() => 
    CAPTION_STYLES.find(s => s.id === captionStyle) || CAPTION_STYLES[0],
    [captionStyle]
  );

  // Helper function to format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 5) return "almost done";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Check video processing count on mount
  useEffect(() => {
    fetchVideosProcessedCount();
  }, []);

  // Persist cloud state to localStorage
  useEffect(() => {
    if (cloudPredictionId) {
      localStorage.setItem('cloudPredictionId', cloudPredictionId);
    } else {
      localStorage.removeItem('cloudPredictionId');
    }
  }, [cloudPredictionId]);

  useEffect(() => {
    if (cloudVideoUrl) {
      localStorage.setItem('cloudVideoUrl', cloudVideoUrl);
    } else {
      localStorage.removeItem('cloudVideoUrl');
    }
  }, [cloudVideoUrl]);

  useEffect(() => {
    if (cloudStartTime > 0) {
      localStorage.setItem('cloudStartTime', cloudStartTime.toString());
    } else {
      localStorage.removeItem('cloudStartTime');
    }
  }, [cloudStartTime]);

  // Track elapsed time for cloud processing
  useEffect(() => {
    if (!cloudPolling || cloudStartTime === 0) {
      setCloudElapsedTime(0);
      return;
    }
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - cloudStartTime) / 1000);
      setCloudElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [cloudPolling, cloudStartTime]);

  // Restore cloud processing state on mount
  useEffect(() => {
    const savedPredictionId = localStorage.getItem('cloudPredictionId');
    const savedStartTime = localStorage.getItem('cloudStartTime');
    
    if (savedPredictionId && savedStartTime) {
      const startTime = parseInt(savedStartTime, 10);
      const elapsed = Date.now() - startTime;
      
      // Only resume polling if less than 15 minutes have passed
      if (elapsed < 900000) {
        console.log('[Cloud] Resuming cloud processing from previous session...');
        setCloudPolling(true);
        setCloudStartTime(startTime);
        pollCloudPrediction(savedPredictionId, startTime, Math.floor(elapsed / 4000), cloudPollTokenRef.current);
        toast.info('Resuming video processing from previous session...');
      } else {
        // Clear stale data
        localStorage.removeItem('cloudPredictionId');
        localStorage.removeItem('cloudStartTime');
      }
    }
  }, []);

  // FFmpeg loader with retry and timeout
  const loadFFmpegCore = async (baseURL: string) => {
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  };

  const loadFFmpeg = async () => {
    if (ffmpegLoaded || ffmpegLoading) return;
    setFfmpegLoading(true);
    setFfmpegError(null);
    console.log('[FFmpeg] Starting to load FFmpeg...');

    const withTimeout = async <T,>(p: Promise<T>, ms = 7000): Promise<T> => {
      return await Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('ffmpeg_load_timeout')), ms)) as Promise<T>,
      ]);
    };

    try {
      // Try primary CDN (unpkg) with timeout
      await withTimeout(loadFFmpegCore('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'));
      setFfmpegLoaded(true);
      console.log('[FFmpeg] FFmpeg loaded successfully (unpkg)');
      toast.success('Video processor ready!');
    } catch (err) {
      console.warn('[FFmpeg] Primary CDN failed or timed out, trying jsDelivr...', err);
      try {
        await withTimeout(loadFFmpegCore('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'));
        setFfmpegLoaded(true);
        console.log('[FFmpeg] FFmpeg loaded successfully (jsDelivr)');
        toast.success('Video processor ready!');
      } catch (e2) {
        console.warn('[FFmpeg] Both CDNs failed, trying local /ffmpeg...', e2);
        try {
          await withTimeout(loadFFmpegCore('/ffmpeg'));
          setFfmpegLoaded(true);
          console.log('[FFmpeg] FFmpeg loaded successfully (local)');
          toast.success('Video processor ready!');
        } catch (e3) {
          console.warn('[FFmpeg] All sources failed, will use cloud processing:', e3);
          setFfmpegError('Video processor unavailable. Cloud processing will be used.');
          toast.info('Using cloud processing for video rendering. You can proceed.');
          // Don't throw - cloud processing is a valid fallback
        }
      }
    } finally {
      setFfmpegLoading(false);
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  // Calculate time remaining in trial
  const getTrialTimeRemaining = () => {
    if (!subscription.isInTrial || !subscription.trialEnd) return null;
    const now = new Date().getTime();
    const end = new Date(subscription.trialEnd).getTime();
    const remaining = end - now;
    
    if (remaining <= 0) return 'Trial expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const hasAccess = user && (subscription.subscribed || subscription.isInTrial);
  // Allow free generation for both guests and logged-in users
  const canUseFree = (!user && freeGenerationsUsed < 1) || (user && videosProcessedCount < 1);
  const canGenerate = hasAccess || canUseFree;

  // Fetch the user's videos processed count
  const fetchVideosProcessedCount = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (user) {
        const {
          data,
          error
        } = await supabase.from('profiles').select('videos_processed_count').eq('id', user.id).single();
        if (!error && data) {
          setVideosProcessedCount(data.videos_processed_count || 0);
        }
      }
    } catch (err) {
      console.error('[KyrgyzSubtitleGenerator] Failed to fetch videos processed count:', err);
    }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleBlobUrl) return;
    
    console.log('[KyrgyzSubtitleGenerator] Subtitle blob updated, reloading video track');
    
    const showTracks = () => {
      const tracks = video.textTracks;
      console.log('[KyrgyzSubtitleGenerator] textTracks count:', tracks.length);
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'showing';
        console.log('[KyrgyzSubtitleGenerator] set track', i, 'mode to', tracks[i].mode, 'cues:', tracks[i].cues?.length ?? 0);
      }
    };
    
    // Reload video to apply new track
    video.load();
    
    // Show tracks immediately after load
    video.addEventListener('loadeddata', showTracks, { once: true });
    
    return () => {
      video.removeEventListener('loadeddata', showTracks);
    };
  }, [subtitleBlobUrl]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || parsedCues.length === 0) {
      setCurrentCueIndex(-1);
      return;
    }
    const onTime = () => {
      const t = video.currentTime;
      const index = parsedCues.findIndex(c => t >= c.start && t <= c.end);
      setCurrentCueIndex(index);
    };
    video.addEventListener('timeupdate', onTime);
    onTime();
    return () => video.removeEventListener('timeupdate', onTime);
  }, [parsedCues, videoUrl]);
  useEffect(() => {
    if (currentCueIndex >= 0 && subtitleRefs.current[currentCueIndex]) {
      subtitleRefs.current[currentCueIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentCueIndex]);

  // Track processing progress based on elapsed time
  useEffect(() => {
    if (!isProcessingVideo || processingStartTime === 0) {
      setProcessingProgress(0);
      setEstimatedTimeRemaining(0);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = (Date.now() - processingStartTime) / 1000; // seconds
      
      // Dynamic estimation based on elapsed time
      // Start with 90 seconds estimate, adjust as processing continues
      let estimatedTotal = 90;
      
      if (elapsed > 60) {
        // After 1 minute, extend estimate if still processing
        estimatedTotal = elapsed + 60;
      } else if (elapsed > 30) {
        // After 30s, adjust estimate to 120s if needed
        estimatedTotal = Math.max(90, elapsed * 2);
      }
      
      const progress = Math.min((elapsed / estimatedTotal) * 100, 90);
      setProcessingProgress(progress);
      
      // Calculate time remaining
      const timeRemaining = Math.max(estimatedTotal - elapsed, 5); // Always show at least 5s
      setEstimatedTimeRemaining(timeRemaining);
    }, 500);
    return () => clearInterval(interval);
  }, [isProcessingVideo, processingStartTime]);

  // Auto-regenerate subtitles when language changes
  const prevLanguageRef = useRef(selectedLanguage);
  const languageChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('preferredSubtitleLanguage', selectedLanguage);
  }, [selectedLanguage]);
  
  useEffect(() => {
    // Only regenerate if language actually changed and we have necessary data
    if (prevLanguageRef.current !== selectedLanguage && prevLanguageRef.current !== '' && videoPath && subtitles) {
      console.log(`[KyrgyzSubtitleGenerator] Language changed from ${prevLanguageRef.current} to ${selectedLanguage}`);
      
      // Clear any pending language change
      if (languageChangeTimeoutRef.current) {
        clearTimeout(languageChangeTimeoutRef.current);
      }
      
      // Debounce to handle rapid language switches
      languageChangeTimeoutRef.current = setTimeout(() => {
        if (isGenerating) {
          console.log('[KyrgyzSubtitleGenerator] Skipping regeneration - already generating');
          return;
        }
        
        toast.info(`Updating subtitles to ${LANGUAGE_NAMES[selectedLanguage] || selectedLanguage}...`);
        
        // Clear current subtitle blob
        if (subtitleBlobUrl) {
          URL.revokeObjectURL(subtitleBlobUrl);
          setSubtitleBlobUrl(null);
        }
        
        generateSubtitlesForPath(videoPath);
      }, 300);
    }
    
    prevLanguageRef.current = selectedLanguage;
    
    return () => {
      if (languageChangeTimeoutRef.current) {
        clearTimeout(languageChangeTimeoutRef.current);
      }
    };
  }, [selectedLanguage]);
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const requestId = generateRequestId();
    const uploadStartTime = Date.now();
    
    console.log(`[${requestId}] FILE SELECTED`, {
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    // Validate file type
    if (!file.type.startsWith('video/')) {
      console.error(`[${requestId}] VALIDATION FAILED: Invalid file type`, { fileType: file.type });
      toast.error("Please select a video file");
      return;
    }

    // Validate file size (max 200MB)
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    if (file.size > MAX_SIZE) {
      console.error(`[${requestId}] VALIDATION FAILED: File too large`, { 
        fileSize: file.size, 
        maxSize: MAX_SIZE,
        sizeMB: Math.round(file.size / 1024 / 1024)
      });
      toast.error(`Video file must be less than 200MB (current: ${Math.round(file.size / 1024 / 1024)}MB). Please compress your video.`);
      return;
    }

    // Store the file for later use in burning subtitles
    setVideoFile(file);

    // Reset all state when uploading a new video
    setVideoUrl(null);
    setVideoPath(null);
    setSubtitles("");
    setEditedSubtitles("");
    setTranscription("");
    setSubtitleBlobUrl(null);
    setParsedCues([]);
    setCurrentCueIndex(-1);
    setIsProcessingVideo(false);
    setProcessingStatus('');
    setProcessingProgress(0);
    setHasUnsavedChanges(false);
    
    // Clear cloud processing state
    setCloudPredictionId(null);
    setCloudVideoUrl(null);
    setCloudStatus('');
    setCloudPolling(false);
    setCloudStartTime(0);
    setCloudElapsedTime(0);
    localStorage.removeItem('cloudPredictionId');
    localStorage.removeItem('cloudVideoUrl');
    localStorage.removeItem('cloudStartTime');
    // Cancel any in-flight pollers
    cloudPollTokenRef.current += 1;
    setIsUploading(true);
    setUploadProgress(0);
    
    // Detect mobile device early for upload optimization
    const isMobile = isMobileDevice();

    // Simulate upload progress based on file size
    const simulateProgress = () => {
      const fileSize = file.size;
      // For mobile, be more conservative with time estimates
      const baseTime = isMobile ? 2000 : 1500; // ms per MB
      const estimatedTime = Math.min(fileSize / (1024 * 1024) * baseTime, 300000);
      const interval = 200;
      const increment = 100 / (estimatedTime / interval) * 1.4;

      const timer = setInterval(() => {
        setUploadProgress(prev => {
          // On mobile, stop at 90% to avoid "stuck at 99%" perception
          // On desktop, go to 95%
          const maxProgress = isMobile ? 90 : 95;
          if (prev < maxProgress) {
            return Math.min(prev + increment, maxProgress);
          }
          // Very slow trickle after that
          return Math.min(prev + 0.03, maxProgress + 8);
        });
      }, interval);
      return timer;
    };
    const progressTimer = simulateProgress();
    try {
      // Check if user is authenticated (optional for guest uploads)
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();

      // Generate unique file name (works for both authenticated and guest users)
      const userId = user?.id || 'guest';
      const fileName = `${userId}/${Date.now()}_${file.name}`;
      
      console.log(`[${requestId}] UPLOAD START`, {
        fileName,
        fileSize: file.size,
        userId: userId.substring(0, 8),
        device: isMobile ? 'Mobile' : 'Desktop',
        timestamp: new Date().toISOString()
      });

      // Add timeout wrapper for upload
      const uploadPromise = supabase.storage.from('videos').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

      // Set timeout based on file size and device
      // Mobile devices get more generous timeouts: 25s per MB vs 12s per MB for desktop
      // Also increase base timeout for mobile to account for connection establishment
      const secondsPerMB = isMobile ? 25 : 12;
      const baseTimeout = isMobile ? 45000 : 30000; // 45s vs 30s base
      const timeoutMs = baseTimeout + file.size / (1024 * 1024) * secondsPerMB * 1000;
      
      console.log(`[${requestId}] UPLOAD CONFIGURATION`, {
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        timeout: `${Math.round(timeoutMs / 1000)}s`,
        secondsPerMB,
        device: isMobile ? 'Mobile' : 'Desktop'
      });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout - please check your connection and try again')), timeoutMs));

      // Fallback: if the SDK upload promise hangs, poll storage to detect if the file actually exists
      const pollFileExists = async (): Promise<'exists'> => {
        const folder = fileName.split('/')[0];
        const target = fileName.split('/').pop();
        const started = Date.now();
        // More aggressive polling on mobile - check every 2s instead of 3s
        const pollInterval = isMobile ? 2000 : 3000;
        let attempts = 0;
        
        while (Date.now() - started < timeoutMs) {
          attempts++;
          try {
            const {
              data
            } = await supabase.storage.from('videos').list(folder);
            if (data?.some((o: any) => o.name === target)) {
              console.log(`[${requestId}] File detected via polling after ${attempts} attempts`);
              return 'exists';
            }
          } catch (e) {
            console.log(`[${requestId}] Polling attempt ${attempts} failed, retrying...`);
          }
          await new Promise(r => setTimeout(r, pollInterval));
        }
        throw new Error('Upload verification timed out');
      };
      const existsPromise = pollFileExists();
      const winner: any = await Promise.race([uploadPromise, existsPromise, timeoutPromise]);
      clearInterval(progressTimer);
      
      // Show a brief "finalizing" state before jumping to 100%
      setUploadProgress(98);
      await new Promise(r => setTimeout(r, 200));
      setUploadProgress(100);

      // If the race winner is the polling result, treat as success; otherwise check SDK response error
      if (winner !== 'exists' && winner?.error) {
        throw winner.error;
      }
      
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`[${requestId}] UPLOAD SUCCESS`, {
        fileName,
        uploadDuration: `${uploadDuration}s`,
        uploadSpeed: `${(file.size / (1024 * 1024) / parseFloat(uploadDuration)).toFixed(2)} MB/s`,
        winnerType: winner === 'exists' ? 'polling' : 'direct',
        timestamp: new Date().toISOString()
      });

      // Show 100% completion briefly before continuing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('videos').getPublicUrl(fileName);
      setVideoUrl(publicUrl);
      setVideoPath(fileName);
      toast.success("Video uploaded successfully");

      // Reset upload progress before generating subtitles
      setUploadProgress(0);
      setIsUploading(false);

      // Auto-generate subtitles after upload
      await generateSubtitlesForPath(fileName, requestId);
    } catch (error: any) {
      const isMobile = isMobileDevice();
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      
      console.error(`[${requestId}] UPLOAD FAILED`, {
        error: error.message,
        uploadDuration: `${uploadDuration}s`,
        status: error.status,
        statusCode: error.statusCode,
        device: isMobile ? 'Mobile' : 'Desktop',
        timestamp: new Date().toISOString()
      });

      // Always clear progress timer on error
      clearInterval(progressTimer);
      setIsUploading(false);
      setUploadProgress(0);

      // Provide helpful, device-specific error message
      let errorMessage = "Failed to upload video";
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        if (isMobile) {
          errorMessage = "Upload timed out. Mobile uploads can be slower. Try: 1) Switch to WiFi, 2) Use a smaller video, 3) Move to a location with better signal.";
        } else {
          errorMessage = "Upload timed out. Please check your internet connection and try again with a smaller video.";
        }
      } else if (error.message) {
        errorMessage = isMobile ? `${error.message} (Mobile device detected - try WiFi for better stability)` : error.message;
      }
      toast.error(errorMessage, {
        duration: 6000
      }); // Longer duration for mobile tips
    }
  };
  const applyModificationsToExistingSubtitles = async () => {
    if (!editedSubtitles) {
      toast.error("No subtitles to modify");
      return;
    }

    const rid = generateRequestId();
    console.log(`[${rid}] APPLYING MODIFICATIONS TO EXISTING SUBTITLES`, {
      addEmojis,
      correctSpelling,
      hasEdits: hasUnsavedChanges,
      timestamp: new Date().toISOString()
    });

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('apply-subtitle-modifications', {
        body: {
          subtitles: editedSubtitles,
          addEmojis,
          correctSpelling,
          requestId: rid,
          language: selectedLanguage,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      console.log(`[${rid}] MODIFICATIONS APPLIED SUCCESSFULLY`);

      // Update subtitles with the modified version
      setSubtitles(data.subtitles);
      setEditedSubtitles(data.subtitles);
      setHasUnsavedChanges(false);
      setParsedCues(parseSrtToCues(data.subtitles));

      // Update the video player subtitles
      const webvtt = convertSrtToWebVtt(data.subtitles);
      console.log('[KyrgyzSubtitleGenerator] Modified subtitle preview (first 300 chars):', data.subtitles.substring(0, 300));
      const blob = new Blob([webvtt], { type: 'text/vtt;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      setSubtitleBlobUrl(blobUrl);

      toast.success("Captions updated with your changes preserved!");
    } catch (error: any) {
      console.error(`[${rid}] MODIFICATION FAILED`, error);
      toast.error(error.message || "Failed to apply modifications");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSubtitlesForPath = async (path: string, requestId?: string) => {
    if (!path) {
      toast.error("Please upload a video first");
      return;
    }
    
    const rid = requestId || generateRequestId();
    const subtitleStartTime = Date.now();
    
    console.log(`[${rid}] SUBTITLE GENERATION START`, {
      videoPath: path,
      addEmojis,
      correctSpelling,
      timestamp: new Date().toISOString()
    });
    
    setIsGenerating(true);
    
    // Track free generation usage for non-authenticated users
    if (!user) {
      const newCount = freeGenerationsUsed + 1;
      setFreeGenerationsUsed(newCount);
      localStorage.setItem('freeGenerationsUsed', newCount.toString());
    }
    
    let responseData: any = null;
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-kyrgyz-subtitles', {
        body: {
          videoPath: path,
          addEmojis: addEmojis,
          correctSpelling: correctSpelling,
          language: selectedLanguage,
          requestId: rid
        },
        headers: (await supabase.auth.getSession()).data.session?.access_token ? {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session!.access_token}`
        } : undefined
      });
      console.log('[KyrgyzSubtitleGenerator] Response data:', data);
      console.log('[KyrgyzSubtitleGenerator] Response error:', error);
      responseData = data;

      // Check for error in response data first (edge function returned error details)
      if (data?.error) {
        throw new Error(data.error);
      }
      if (error) throw error;
      
      const subtitleDuration = ((Date.now() - subtitleStartTime) / 1000).toFixed(2);
      const subtitleCount = parseSrtToCues(data.subtitles).length;
      
      console.log(`[${rid}] SUBTITLE GENERATION SUCCESS`, {
        subtitleCount,
        transcriptionLength: data.transcription?.length || 0,
        duration: `${subtitleDuration}s`,
        timestamp: new Date().toISOString()
      });
      
      setSubtitles(data.subtitles);
      setEditedSubtitles(data.subtitles);
      setHasUnsavedChanges(false);
      setTranscription(data.transcription);
      setParsedCues(parseSrtToCues(data.subtitles));

      // Convert SRT to WebVTT format for video player
      const webvtt = convertSrtToWebVtt(data.subtitles);
      console.log('[KyrgyzSubtitleGenerator] Subtitle preview (first 300 chars):', data.subtitles.substring(0, 300));
      console.log('[KyrgyzSubtitleGenerator] WebVTT preview:', webvtt.substring(0, 200));
      const blob = new Blob([webvtt], {
        type: 'text/vtt;charset=utf-8'
      });
      const blobUrl = URL.createObjectURL(blob);
      setSubtitleBlobUrl(blobUrl);
      console.log('[KyrgyzSubtitleGenerator] Subtitles generated, cues:', parsedCues.length);
      toast.success("Subtitles generated successfully");
      
      // For logged-in users, increment videos processed count
      if (user) {
        setVideosProcessedCount(prev => prev + 1);
      }

      // Increment video processing count for authenticated users
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log(`[${rid}] Incrementing video counter for user ${user.id.substring(0, 8)}`);
          const { error: incrementError } = await supabase.rpc('increment_video_processing_count', {
            user_uuid: user.id
          });
          if (incrementError) {
            console.error(`[${rid}] COUNTER INCREMENT FAILED`, {
              error: incrementError,
              message: incrementError.message,
              details: incrementError.details,
              hint: incrementError.hint,
              code: incrementError.code
            });
            toast.error("Failed to update video counter");
          } else {
            console.log(`[${rid}] Counter incremented successfully`);
            // Refresh the displayed count
            await fetchVideosProcessedCount();
          }
        } else {
          console.warn(`[${rid}] Cannot increment counter: user not authenticated`);
          toast.error("Please sign in to track your videos");
        }
      } catch (err) {
        console.error(`[${rid}] Error incrementing counter:`, {
          error: err,
          message: (err as any)?.message,
          stack: (err as any)?.stack
        });
        toast.error("Error updating video counter");
      }

      // Auto-generate titles and summaries
      if (data.transcription) {
        console.log('[KyrgyzSubtitleGenerator] Auto-generating titles and summaries...');

        // Generate titles
        setIsGeneratingTitles(true);
        try {
          const {
            data: titleData,
            error: titleError
          } = await supabase.functions.invoke('generate-title-variations', {
            body: {
              transcription: data.transcription
            }
          });
          if (!titleError && titleData?.titles) {
            setTitleVariations(titleData.titles);
            console.log('[KyrgyzSubtitleGenerator] Titles generated automatically');
          }
        } catch (err) {
          console.error('[KyrgyzSubtitleGenerator] Auto title generation failed:', err);
        } finally {
          setIsGeneratingTitles(false);
        }

        // Generate summaries
        setIsGeneratingSummaries(true);
        try {
          const {
            data: summaryData,
            error: summaryError
          } = await supabase.functions.invoke('generate-video-summary', {
            body: {
              transcription: data.transcription
            }
          });
          if (!summaryError && summaryData?.summaries) {
            setSummaries(summaryData.summaries);
            console.log('[KyrgyzSubtitleGenerator] Summaries generated automatically');
          }
        } catch (err) {
          console.error('[KyrgyzSubtitleGenerator] Auto summary generation failed:', err);
        } finally {
          setIsGeneratingSummaries(false);
        }
        toast.success("AI content generated!");
      }
    } catch (error: any) {
      const subtitleDuration = ((Date.now() - subtitleStartTime) / 1000).toFixed(2);
      
      console.error(`[${rid}] SUBTITLE GENERATION FAILED`, {
        error: error.message,
        duration: `${subtitleDuration}s`,
        responseData: responseData ? JSON.stringify(responseData).substring(0, 200) : null,
        timestamp: new Date().toISOString()
      });

      // Extract the actual error message
      let errorMessage = error.message || "Failed to generate subtitles";

      // Check for specific "audio too short" error
      if (errorMessage.includes("audio_too_short") || errorMessage.includes("Audio is too short")) {
        errorMessage = "The video is too short for subtitle generation. Please upload a longer video (at least 10 seconds).";
      }
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };
  const convertSrtToWebVtt = (srt: string): string => {
    // Robust SRT -> WebVTT conversion: remove code fences, numeric cue IDs, and fix timestamps
    const normalized = srt
      .replace(/\r+/g, '')
      // strip Markdown code fences like ```srt and ```
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '')
      .trim();
    const cues = normalized.split('\n\n').map(block => {
      const lines = block.split('\n').filter(l => !/^```/.test(l));
      // Remove numeric cue identifier if present
      if (lines[0] && /^\d+$/.test(lines[0])) {
        lines.shift();
      }
      return lines.join('\n');
    }).join('\n\n');
    const withDots = cues.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
    const styleHeader = `WEBVTT

STYLE
::cue { font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'EmojiOne Color', 'Segoe UI Symbol', 'Symbola', ui-sans-serif, system-ui, sans-serif; font-size: 1.1em; line-height: 1.35; }

`;
    return styleHeader + withDots;
  };
  const parseSrtToCues = (srt: string) => {
    const normalized = srt
      .replace(/\r+/g, '')
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '')
      .trim();
    const blocks = normalized.split('\n\n');
    const cues: Array<{
      start: number;
      end: number;
      text: string;
    }> = [];
    for (const block of blocks) {
      const lines = block.split('\n').filter(l => !/^```/.test(l));
      if (!lines.length) continue;
      if (/^\d+$/.test(lines[0])) lines.shift();
      const timing = lines.shift() || '';
      const m = timing.match(/(\d+:\d+:\d+)[,.](\d+)\s+-->\s+(\d+:\d+:\d+)[,.](\d+)/);
      if (!m) continue;
      const start = hmsToSeconds(m[1], m[2]);
      const end = hmsToSeconds(m[3], m[4]);
      const text = lines.join('\n');
      cues.push({ start, end, text });
    }
    return cues;
  };
  const hmsToSeconds = (hms: string, ms: string) => {
    const [h, m, s] = hms.split(':').map(Number);
    return h * 3600 + m * 60 + s + Number(ms) / 1000;
  };
  const applySubtitleChanges = () => {
    setParsedCues(parseSrtToCues(editedSubtitles));
    const webvtt = convertSrtToWebVtt(editedSubtitles);
    console.log('[KyrgyzSubtitleGenerator] Applying subtitle changes, preview:', editedSubtitles.substring(0, 300));
    const blob = new Blob([webvtt], {
      type: 'text/vtt;charset=utf-8'
    });
    const blobUrl = URL.createObjectURL(blob);
    setSubtitleBlobUrl(blobUrl);
    setSubtitles(editedSubtitles);
    setHasUnsavedChanges(false);
    toast.success("Captions updated");
  };
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor(seconds % 1 * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };
  const handleCueTextChange = (index: number, newText: string) => {
    const newCues = [...parsedCues];
    newCues[index] = {
      ...newCues[index],
      text: newText
    };
    setParsedCues(newCues);

    // Convert back to SRT format
    const srt = newCues.map((cue, i) => {
      return `${i + 1}\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text}\n`;
    }).join('\n');
    setEditedSubtitles(srt);
    setHasUnsavedChanges(true);
  };
  const downloadVideoWithSubtitles = async () => {
    if (!videoFile || !subtitles) {
      toast.error("No video or subtitles available");
      return;
    }

    // Check if already processing
    if (cloudPolling || isProcessingVideo) {
      toast.error("Video is already processing. Please wait...");
      return;
    }

    // If video was already processed and ready, download from cloud URL
    if (cloudVideoUrl && processorReady) {
      console.log('Download started for file:', cloudVideoUrl);
      try {
        const response = await fetch(cloudVideoUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kyrgyz_summary_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Video downloaded!");
        return;
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Download failed: ' + (error as Error).message);
        return;
      }
    }

    // Prefer local FFmpeg processing when available; otherwise use cloud
    if (!ffmpegLoaded) {
      if (cloudVideoUrl) {
        console.log('Download started for file:', cloudVideoUrl);
        try {
          const response = await fetch(cloudVideoUrl);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `kyrgyz_summary_${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Video downloaded!");
          return;
        } catch (error) {
          console.error('Download error:', error);
          toast.error('Download failed: ' + (error as Error).message);
          return;
        }
      }
      toast.info("Starting cloud processing...");
      setProcessorReady(false);
      await burnVideoInCloud();
      return;
    }

    const requestId = generateRequestId();
    const processingStartTime = Date.now();
    
    console.log(`[${requestId}] LOCAL VIDEO PROCESSING START`, {
      subtitlesLength: subtitles.length,
      captionStyle: captionStyle,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessingVideo(true);
    setProcessingStatus('processing');
    setProcessingProgress(0);
    setProcessingStartTime(processingStartTime);

    try {
      toast.info("Processing video locally...");
      const ffmpeg = ffmpegRef.current;

      // Write video file to FFmpeg virtual filesystem
      console.log(`[${requestId}] Writing video file to FFmpeg...`);
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
      setProcessingProgress(10);
      
      // Clean and prepare SRT content - use edited subtitles if available
      const useSubs = editedSubtitles || subtitles;
      let cleanSubtitles = useSubs.trim();
      if (cleanSubtitles.startsWith('```')) {
        cleanSubtitles = cleanSubtitles.replace(/^```[a-z]*\n/, '').replace(/\n?```$/, '');
      }
      
      const srtContent = cleanSubtitles
        .split('\n')
        .map((line: string) => {
          const isTiming = /^\d+:\d+:\d+[,.]\d+\s+-->\s+\d+:\d+:\d+[,.]\d+/.test(line);
          if (isTiming) return line.trim();
          return line
            .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .trimEnd();
        })
        .join('\n');

      console.log(`[${requestId}] Writing SRT file to FFmpeg...`);
      await ffmpeg.writeFile('subtitles.srt', new TextEncoder().encode(srtContent));
      setProcessingProgress(20);

      // Load a broad-coverage emoji font into FFmpeg's FS so emojis render
      try {
        console.log(`[${requestId}] Loading emoji font for FFmpeg...`);
        const fontBinary = await fetchFile('/fonts/Symbola.ttf');
        await ffmpeg.writeFile('Symbola.ttf', fontBinary); // write at FS root
        console.log(`[${requestId}] Emoji font loaded`);
      } catch (e) {
        console.warn(`[${requestId}] Emoji font load failed (will continue without it)`, e);
      }

      // Build subtitle style based on user selection
      let subtitleFilter = 'subtitles=subtitles.srt:charenc=UTF-8:fontsdir=.:force_style=';
      const styleOptions = [];

      if (currentStyle.prompt.includes('yellow') || currentStyle.prompt.includes('Highlight')) {
        styleOptions.push('PrimaryColour=&H00FFFF', 'OutlineColour=&HFFFFFF', 'Outline=2');
      } else if (currentStyle.prompt.includes('green') || currentStyle.prompt.includes('Framed')) {
        styleOptions.push('PrimaryColour=&H00FF00', 'OutlineColour=&H000000', 'Outline=2', 'BorderStyle=3');
      } else if (currentStyle.prompt.includes('minimal') || currentStyle.prompt.includes('Subtle')) {
        styleOptions.push('PrimaryColour=&HFFFFFF', 'BackColour=&H80000000', 'FontSize=18', 'Bold=0');
      } else {
        // Default: white text with black outline (Stroke style)
        styleOptions.push('PrimaryColour=&HFFFFFF', 'OutlineColour=&H000000', 'Outline=3', 'Bold=1');
      }
      
      // Use DejaVu Sans which supports emojis better than Arial
      styleOptions.push('FontSize=18', 'Alignment=2', 'MarginV=20', 'FontName=Symbola');
      subtitleFilter += styleOptions.join(',');

      console.log(`[${requestId}] Running FFmpeg with filter: ${subtitleFilter}`);
      setProcessingProgress(30);

      // Run FFmpeg to burn subtitles
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', subtitleFilter,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        'output.mp4'
      ]);

      console.log(`[${requestId}] FFmpeg processing complete`);
      setProcessingProgress(90);

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([new Uint8Array(data as any)], { type: 'video/mp4' });
      const downloadSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      
      console.log(`[${requestId}] Creating download link...`, {
        fileSizeMB: downloadSizeMB
      });

      const videoLink = document.createElement('a');
      videoLink.href = URL.createObjectURL(blob);
      videoLink.download = 'video_with_subtitles.mp4';
      document.body.appendChild(videoLink);
      videoLink.click();
      document.body.removeChild(videoLink);
      URL.revokeObjectURL(videoLink.href);

      const endToEndDuration = ((Date.now() - processingStartTime) / 1000).toFixed(2);
      console.log(`[${requestId}] DOWNLOAD COMPLETE`, {
        totalDuration: `${endToEndDuration}s`,
        fileSizeMB: downloadSizeMB,
        timestamp: new Date().toISOString()
      });

      setProcessingProgress(100);
      setProcessorReady(true);
      toast.success("Video with burned subtitles downloaded successfully!");
      
      // Show signup prompt after successful download if user just used their free generation
      if (!user && freeGenerationsUsed >= 1) {
        setShowSignupPrompt(true);
      }

    } catch (error: any) {
      const errorDuration = ((Date.now() - processingStartTime) / 1000).toFixed(2);
      
      console.error(`[${requestId}] VIDEO PROCESSING FAILED`, {
        error: error.message,
        duration: `${errorDuration}s`,
        timestamp: new Date().toISOString()
      });
      
      toast.error("Processing failed: " + (error?.message || 'Unknown error'));
    } finally {
      setIsProcessingVideo(false);
      setProcessingStatus('');
      setProcessingProgress(0);
      setProcessingStartTime(0);
    }
  };

  // Cloud burning fallback via backend with timeout
  const pollCloudPrediction = async (
    predictionId: string,
    startTime: number = Date.now(),
    attemptCount: number = 0,
    token: number = cloudPollTokenRef.current
  ) => {
    // Abort if a new job has started
    if (token !== cloudPollTokenRef.current) return;
    setCloudPolling(true);
    setCloudStatus('queued');
    
    // 10 minute timeout (600 seconds)
    const TIMEOUT_MS = 10 * 60 * 1000;
    const MAX_ATTEMPTS = 150; // 150 attempts * 4s = 10 minutes
    const elapsed = Date.now() - startTime;
    
    if (elapsed > TIMEOUT_MS || attemptCount > MAX_ATTEMPTS) {
      setCloudPolling(false);
      setCloudStatus('timeout');
      toast.error('Cloud processing timed out after 10 minutes. The video may be too large or complex. Try a shorter video or simpler caption style.');
      return;
    }
    
    // Show progress feedback
    if (attemptCount === 15) { // After 1 minute
      toast.info('Still processing... Large videos can take 5-10 minutes');
    } else if (attemptCount === 45) { // After 3 minutes
      toast.info('Processing is taking longer than usual. Please be patient...');
    }
    
    try {
      const pollOnce = async () => {
        const { data, error } = await supabase.functions.invoke('burn-subtitles-backend', {
          body: { predictionId, requestId: generateRequestId() },
        });
        if (error) throw error;
        
        // Check for explicit error response
        if (data?.success === false) {
          setCloudStatus('failed');
          setCloudPolling(false);
          setCloudStartTime(0);
          localStorage.removeItem('cloudPredictionId');
          localStorage.removeItem('cloudStartTime');
          toast.error(data?.details || data?.error || 'Cloud processing failed');
          return true;
        }
        
        if (data?.status === 'succeeded' && data?.videoUrl) {
          setCloudStatus('succeeded');
          setCloudVideoUrl(data.videoUrl);
          setCloudPolling(false);
          setCloudStartTime(0);
          setProcessorReady(true);
          
          // Clear localStorage
          localStorage.removeItem('cloudPredictionId');
          localStorage.removeItem('cloudStartTime');
          
          console.log('Download started for file:', data.videoUrl);
          toast.success('Cloud video ready! Downloading...');
          try {
            const response = await fetch(data.videoUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kyrgyz_summary_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Auto-download failed, opening in new tab', e);
            window.open(data.videoUrl, '_blank');
          }
          return true;
        }
        if (data?.status === 'failed') {
          setCloudStatus('failed');
          setCloudPolling(false);
          setCloudStartTime(0);
          
          // Clear localStorage
          localStorage.removeItem('cloudPredictionId');
          localStorage.removeItem('cloudStartTime');
          
          toast.error(data?.error || 'Cloud processing failed');
          return true;
        }
        setCloudStatus(data?.status || 'processing');
        return false;
      };
      const done = await pollOnce();
      // Use longer polling interval after 2 minutes to reduce server load
      const pollInterval = attemptCount > 30 ? 6000 : 4000;
      if (!done) setTimeout(() => pollCloudPrediction(predictionId, startTime, attemptCount + 1, token), pollInterval);
    } catch (e: any) {
      setCloudPolling(false);
      setCloudStatus('error');
      setCloudStartTime(0);
      
      // Clear localStorage
      localStorage.removeItem('cloudPredictionId');
      localStorage.removeItem('cloudStartTime');
      
      toast.error(e.message || 'Cloud polling error');
    }
  };

  const burnVideoInCloud = async () => {
    if (!videoPath || !(editedSubtitles || subtitles)) {
      toast.error('No video or captions available');
      return;
    }
    
    // Check if already processing
    if (cloudPolling) {
      toast.error('Cloud processing already in progress. Please wait...');
      return;
    }
    
    const useSubs = editedSubtitles || subtitles;
    const rid = generateRequestId();
    const startTime = Date.now();
    
    try {
      setCloudStatus('starting');
      setCloudPolling(true);
      setCloudStartTime(startTime);
      
      const { data, error } = await supabase.functions.invoke('burn-subtitles-backend', {
        body: {
          videoPath,
          subtitles: useSubs,
          styleId: currentStyle.id,
          requestId: rid,
          fontUrls: [
            `${window.location.origin}/fonts/Symbola.ttf`,
            `${window.location.origin}/fonts/NotoEmoji.ttf`
          ],
        },
      });
      if (error) throw error;
      
      // Check for explicit error response
      if (data?.success === false) {
        throw new Error(data?.details || data?.error || 'Cloud processing failed');
      }
      
      if (data?.predictionId) {
        setCloudPredictionId(data.predictionId);
        pollCloudPrediction(data.predictionId, startTime, 0);
        toast.info('Started cloud processing... This may take 2-10 minutes depending on video size.');
      } else if (data?.videoUrl) {
        setCloudVideoUrl(data.videoUrl);
        setCloudStatus('succeeded');
        setCloudPolling(false);
        setCloudStartTime(0);
        
        // Clear localStorage
        localStorage.removeItem('cloudPredictionId');
        localStorage.removeItem('cloudStartTime');
        
        toast.success('Cloud video ready! Downloading...');
        try {
          const response = await fetch(data.videoUrl);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `video-with-subtitles-${Date.now()}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Auto-download failed, opening in new tab', e);
          window.open(data.videoUrl, '_blank');
        }
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setCloudStatus('error');
      setCloudPolling(false);
      setCloudStartTime(0);
      
      // Clear localStorage
      localStorage.removeItem('cloudPredictionId');
      localStorage.removeItem('cloudStartTime');
      
      toast.error(e.message || 'Failed to start cloud processing');
    }
  };

  const generateTitleVariations = async () => {
    if (!transcription) {
      toast.error("No transcription available. Please generate subtitles first.");
      return;
    }
    setIsGeneratingTitles(true);
    setTitleVariations([]);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-title-variations', {
        body: {
          transcription
        }
      });
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      if (data?.titles) {
        setTitleVariations(data.titles);
        toast.success("Title variations generated!");
      }
    } catch (error: any) {
      console.error('[KyrgyzSubtitleGenerator] Title generation failed:', error);
      toast.error(error.message || "Failed to generate title variations");
    } finally {
      setIsGeneratingTitles(false);
    }
  };
  const generateSummaries = async () => {
    if (!transcription) {
      toast.error("No transcription available. Please generate subtitles first.");
      return;
    }
    setIsGeneratingSummaries(true);
    setSummaries([]);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-video-summary', {
        body: {
          transcription
        }
      });
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      if (data?.summaries) {
        setSummaries(data.summaries);
        toast.success("Summaries generated!");
      }
    } catch (error: any) {
      console.error('[KyrgyzSubtitleGenerator] Summary generation failed:', error);
      toast.error(error.message || "Failed to generate summaries");
    } finally {
      setIsGeneratingSummaries(false);
    }
  };
  return <>
      <style>{`
        video::cue {
          ${currentStyle.css}
        }
      `}</style>
      
      {/* Trial Countdown Banner */}
      {user && subscription.isInTrial && (
        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold">Free Trial Active</p>
                <p className="text-sm text-muted-foreground">{getTrialTimeRemaining()}</p>
              </div>
            </div>
            <Button size="sm" variant="outline">
              View Plans
            </Button>
          </div>
        </div>
      )}

      {/* Subscription Status Badge */}
      {user && subscription.subscribed && !subscription.isInTrial && (
        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Pro Subscription Active</span>
          </div>
        </div>
      )}
      
      {/* Counter at the top of the page */}
      {videosProcessedCount > 0}
      
      {/* Free Generation Banner */}
      {!hasAccess && (
        <div className="mb-4 p-4 rounded-lg border bg-primary/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">
                  {canUseFree ? 'Free Trial Available' : 'Free Trial Used'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {canUseFree 
                    ? (user ? '1 free video generation for your account' : '1 free video - no signup required')
                    : 'Start a free trial for unlimited videos'}
                </p>
              </div>
            </div>
            {!canUseFree && (
              <Button onClick={() => setShowSubscriptionModal(true)} size="sm" className="rounded-full">
                Start Free Trial
              </Button>
            )}
          </div>
        </div>
      )}
      
      <Card className="max-w-4xl mx-auto relative">

        <CardHeader className="text-center">
          <CardTitle>Kyrgyz Video Subtitle Generator</CardTitle>
          <CardDescription>Upload a video and generate Kyrgyz subtitles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Only show upload area when no video is uploaded */}
          {!videoUrl && (
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
              <div className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${isDragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted-foreground/25 hover:border-primary/50'}`} onDragOver={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }} onDragEnter={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }} onDragLeave={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }} onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
              const files = e.dataTransfer.files;
              if (files && files[0]) {
                const file = files[0];
                if (file.type.startsWith('video/')) {
                  handleFileSelect({
                    target: {
                      files
                    }
                  } as any);
                } else {
                  toast.error('Please drop a video file');
                }
              }
            }}>
                <div className="flex flex-col items-center gap-3">
                  <div className={`transition-transform ${isDragOver ? 'scale-110' : ''}`}>
                    <Upload className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-1">
                      {isDragOver ? 'Drop your video here' : 'Drag & drop your video'}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">or</p>
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} size="lg" className="text-lg px-8 py-6 font-semibold shadow-lg hover:shadow-xl transition-all">
                      {isUploading ? <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading... {Math.round(uploadProgress)}%
                      </> : <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Video
                      </>}
                    </Button>
                  </div>
                </div>
              </div>
              {isUploading && <div className="w-full space-y-1">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {uploadProgress < 95 ? "Uploading and generating captions... This may take a few minutes for large files." : "Finalizing upload and caption generation... Large files on mobile can take a few minutes."}
                  </p>
                </div>}
            </div>
          )}

          {/* Caption Style Selector */}
          {videoUrl && subtitles && <div className="space-y-2">
              <label className="text-sm font-semibold">Caption Style</label>
              <div className="grid grid-cols-4 gap-2">
                {CAPTION_STYLES.map(style => {
              const getPreviewClasses = () => {
                switch (style.id) {
                  case 'outline':
                    return 'bg-gray-900 text-white font-bold [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000]';
                  case 'minimal':
                    return 'bg-black/70 text-white/90 font-light';
                  case 'green':
                    return 'bg-transparent text-black font-black [text-shadow:0_0_8px_rgba(234,179,8,0.9),-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff]';
                  case 'boxed':
                    return 'bg-black text-green-500 font-bold border-2 border-green-500 [text-shadow:0_0_10px_#00ff00]';
                  default:
                    return '';
                }
              };
              return <button key={style.id} onClick={() => setCaptionStyle(style.id)} className={`p-3 rounded-lg transition-all relative bg-muted hover:bg-muted/80 border-2 ${captionStyle === style.id ? 'border-primary scale-105 shadow-lg' : 'border-transparent hover:border-border'}`}>
                <div className="text-sm font-medium mb-2 text-foreground">
                  {style.name}
                </div>
                <div className={`text-xs px-2 py-1 rounded ${getPreviewClasses()}`}>
                  Preview
                </div>
              </button>;
            })}
              </div>
            </div>}

          {videoUrl && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left side - Controls and Subtitle Editor */}
              <div className="space-y-3">
                {/* Language Selector */}
                <div className="p-3 border rounded-lg bg-card">
                  <Label htmlFor="language-select" className="text-sm font-medium mb-2 block">
                    🌐 Caption Language
                  </Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger id="language-select">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ky">Kyrgyz (Кыргызча)</SelectItem>
                      <SelectItem value="kk">Kazakh (Қазақша)</SelectItem>
                      <SelectItem value="uz">Uzbek (Oʻzbekcha)</SelectItem>
                      <SelectItem value="ru">Russian (Русский)</SelectItem>
                      <SelectItem value="tr">Turkish (Türkçe)</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                      <SelectItem value="zh">Chinese (中文)</SelectItem>
                      <SelectItem value="es">Spanish (Español)</SelectItem>
                      <SelectItem value="fr">French (Français)</SelectItem>
                      <SelectItem value="de">German (Deutsch)</SelectItem>
                      <SelectItem value="hi">Hindi (हिन्दी)</SelectItem>
                      <SelectItem value="ja">Japanese (日本語)</SelectItem>
                      <SelectItem value="ko">Korean (한국어)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select the language for subtitle generation
                  </p>
                </div>

                {/* Emoji Toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div className="space-y-0.5">
                    <Label htmlFor="emoji-toggle" className="text-sm font-medium">
                      😊 Add Emojis to Captions
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {subtitles ? addEmojis ? "Emojis ON — click Regenerate to apply to current captions" : "Turn on and click Regenerate to apply to current captions" : addEmojis ? "Emojis will be added on generation" : "Enhance captions with relevant emojis"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="emoji-toggle" checked={addEmojis} onCheckedChange={setAddEmojis} />
                    {subtitles && <Button size="sm" variant="secondary" onClick={() => {
                        // If user has manual edits, apply modifications to preserve them
                        if (hasUnsavedChanges || editedSubtitles !== subtitles) {
                          applyModificationsToExistingSubtitles();
                        } else {
                          // No manual edits, safe to regenerate from video
                          videoPath && generateSubtitlesForPath(videoPath);
                        }
                      }} disabled={isGenerating}>
                        {isGenerating ? 'Regenerating...' : 'Regenerate'}
                      </Button>}
                  </div>
                </div>

                {/* Subtitle Editor */}
                {subtitles && <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Subtitle Editor</h3>
                        <p className="text-xs text-muted-foreground">
                          {hasUnsavedChanges ? <span className="text-amber-500 font-medium">● Unsaved changes</span> : <span>All changes saved</span>}
                        </p>
                      </div>
                    </div>
                    {currentCueIndex >= 0 && <div className="flex items-center gap-2 px-2.5 py-1 bg-primary/20 rounded-full border border-primary/30">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-medium">Playing #{currentCueIndex + 1}</span>
                      </div>}
                  </div>
                  
                  <div className="border rounded-xl p-2 max-h-[500px] overflow-y-auto space-y-1.5 bg-gradient-to-b from-muted/20 to-muted/5">
                    {parsedCues.map((cue, index) => <div key={index} ref={el => subtitleRefs.current[index] = el} className={`p-2.5 rounded-lg border transition-all duration-300 ${currentCueIndex === index ? 'bg-primary/10 border-primary/40 shadow-lg scale-[1.02] ring-2 ring-primary/20' : 'bg-card/50 border-border/50 hover:bg-card/80 hover:border-border'}`}>
                        <div className="flex items-center justify-between mb-1 pb-1 border-b border-border/50">
                          <span className="text-xs font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">
                            {formatTime(cue.start)} → {formatTime(cue.end)}
                          </span>
                        </div>
                        <Textarea value={cue.text} onChange={e => handleCueTextChange(index, e.target.value)} className="min-h-[50px] text-sm resize-none bg-transparent border-0 p-0 focus-visible:ring-0 font-medium" placeholder="Enter subtitle text..." />
                      </div>)}
                   </div>
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center flex-wrap">
                          {hasUnsavedChanges && (
                            <Button onClick={applySubtitleChanges} className="flex-1 min-w-[160px]">
                              Update Captions
                            </Button>
                          )}

                          <Button
                            onClick={downloadVideoWithSubtitles}
                            size="lg"
                            className={`
                              ${hasUnsavedChanges ? "flex-1" : "w-full"}
                              bg-blue-600 hover:bg-blue-700
                              text-white font-semibold
                              shadow-lg hover:shadow-xl
                              transition-all duration-300
                            `}
                            disabled={
                              (isProcessingVideo || cloudPolling) && !processorReady || !subtitles
                            }
                          >
                            {isProcessingVideo ? (
                              <div className="w-full space-y-2">
                                <div className="flex items-center justify-center gap-2">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span className="text-sm">
                                    {processingStatus.charAt(0).toUpperCase() + processingStatus.slice(1)} - {Math.round(processingProgress)}%
                                    {estimatedTimeRemaining > 0 && ` ~${formatTimeRemaining(estimatedTimeRemaining)} left`}
                                  </span>
                                </div>
                                <Progress value={processingProgress} className="w-full h-2" />
                              </div>
                            ) : cloudPolling ? (
                              <div className="w-full space-y-2">
                                <div className="flex items-center justify-center gap-2">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span className="text-sm">
                                    Processing... {Math.floor(cloudElapsedTime / 60)}m {cloudElapsedTime % 60}s elapsed
                                  </span>
                                </div>
                                <div className="text-xs text-center text-white/70">
                                  Large videos can take 5-10 minutes
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Download className="w-5 h-5" />
                                <span>Download Video</span>
                              </div>
                            )}
                          </Button>
                        </div>

                        {/* Manual download fallback when cloud video is ready */}
                        {cloudVideoUrl && !cloudPolling && (
                          <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                            <div className="flex items-center gap-2 text-sm font-medium text-primary">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Video ready!</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => window.open(cloudVideoUrl, '_blank')}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Open in New Tab
                              </Button>
                              <Button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(cloudVideoUrl);
                                    toast.success('Video link copied!');
                                  } catch (e) {
                                    toast.error('Failed to copy link');
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              >
                                Copy Link
                              </Button>
                            </div>
                          </div>
                        )}

                        {!ffmpegLoaded && !isProcessingVideo && !cloudPolling && !cloudVideoUrl && (
                          <div className="text-xs text-muted-foreground p-2 rounded border bg-muted/50">
                            Cloud mode — Processing with Replicate AI. Click once and wait for completion.
                          </div>
                        )}
                      </div>
                 </div>}
              </div>

              {/* Right side - Video Player */}
              <div className="space-y-2">
                <div className="p-2 h-[800px] flex flex-col">
                  <div className="flex-1 flex items-center justify-center overflow-auto">
                    <video 
                      key={videoUrl} 
                      ref={videoRef} 
                      src={videoUrl} 
                      controls 
                      className="rounded max-w-full max-h-full object-contain" 
                      crossOrigin="anonymous"
                    >
                      {subtitleBlobUrl && (
                        <track
                          key={subtitleBlobUrl}
                          kind="captions"
                          src={subtitleBlobUrl}
                          srcLang={selectedLanguage}
                          label={LANGUAGE_NAMES[selectedLanguage] || selectedLanguage}
                          default
                          ref={trackRef}
                        />
                      )}
                    </video>
                  </div>
                </div>

                {isGenerating && <div className="flex items-center justify-center p-3 border rounded-lg bg-primary/5">
                    <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" />
                    <span className="text-sm font-medium">
                      {subtitles ? `Updating subtitles to ${LANGUAGE_NAMES[selectedLanguage]}...` : `Generating ${LANGUAGE_NAMES[selectedLanguage]} subtitles...`}
                    </span>
                  </div>}
              </div>
            </div>}
      </CardContent>
    </Card>
    
    {/* AI Content Generators */}
    {transcription && <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* Title Variations Generator */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Title Generator
            </CardTitle>
            <CardDescription>
              Generate creative title variations for your video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={generateTitleVariations} disabled={isGeneratingTitles} className="w-full" size="lg">
              {isGeneratingTitles ? <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Titles...
                </> : <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Title Variations
                </>}
            </Button>
            
            {titleVariations.length > 0 && <div className="space-y-3 mt-4">
                <h3 className="font-semibold text-sm text-muted-foreground">Generated Titles:</h3>
                {titleVariations.map((title, index) => <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => {
              navigator.clipboard.writeText(title);
              toast.success("Title copied to clipboard!");
            }}>
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <p className="flex-1 text-sm leading-relaxed group-hover:text-primary transition-colors">
                        {title}
                      </p>
                    </div>
                  </div>)}
                <p className="text-xs text-muted-foreground text-center">
                  Click any title to copy to clipboard
                </p>
              </div>}
          </CardContent>
        </Card>

        {/* Summary Generator */}
        <Card className="border-2 border-secondary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              Video Summary Generator
            </CardTitle>
            <CardDescription>
              Create catchy, clickbaity summaries in Kyrgyz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={generateSummaries} disabled={isGeneratingSummaries} className="w-full" size="lg">
              {isGeneratingSummaries ? <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating Summaries...
                </> : <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Summary
                </>}
            </Button>
            
            {summaries.length > 0 && <div className="space-y-3 mt-4">
                <h3 className="font-semibold text-sm text-muted-foreground">Generated Summaries:</h3>
                {summaries.map((summary, index) => <div key={index} className="p-4 rounded-lg bg-secondary/10 border border-secondary/30 hover:border-secondary/50 transition-colors cursor-pointer group" onClick={() => {
              navigator.clipboard.writeText(summary);
              toast.success("Summary copied to clipboard!");
            }}>
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary/20 text-secondary-foreground text-sm font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <p className="flex-1 text-sm leading-relaxed group-hover:text-secondary transition-colors">
                        {summary}
                      </p>
                    </div>
                  </div>)}
                <p className="text-xs text-muted-foreground text-center">
                  Click any summary to copy to clipboard
                </p>
              </div>}
          </CardContent>
        </Card>
      </div>}

    
    <SubscriptionModal 
      open={showSubscriptionModal} 
      onOpenChange={setShowSubscriptionModal}
    />
    
    {/* Signup Prompt Dialog for Free Users */}
    <Dialog open={showSignupPrompt} onOpenChange={setShowSignupPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Love what you created?</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Sign up for free to continue generating unlimited videos with a 1-day trial!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Unlimited Videos</p>
              <p className="text-xs text-muted-foreground">No limits during trial</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">All Premium Features</p>
              <p className="text-xs text-muted-foreground">Custom styles & more</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">No Credit Card</p>
              <p className="text-xs text-muted-foreground">Start free, upgrade later</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowSignupPrompt(false)} variant="outline" className="flex-1">
            Maybe Later
          </Button>
          <Button onClick={() => window.location.href = '/auth'} className="flex-1">
            Sign Up Free
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>;
};
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Download, Video, Sparkles, Share2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import editingExample from "@/assets/editing-example.png";
export const KyrgyzSubtitleGenerator = () => {
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
  const [addEmojis, setAddEmojis] = useState<boolean>(false);
  const [correctSpelling, setCorrectSpelling] = useState<boolean>(true);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [titleVariations, setTitleVariations] = useState<string[]>([]);
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);
  const [summaries, setSummaries] = useState<string[]>([]);
  const [isTikTokConnected, setIsTikTokConnected] = useState(false);
  const [isCheckingTikTokAuth, setIsCheckingTikTokAuth] = useState(true);
  const [isPublishingToTikTok, setIsPublishingToTikTok] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const subtitleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionStyles = [{
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
  const currentStyle = captionStyles.find(s => s.id === captionStyle) || captionStyles[0];

  // Helper function to format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "almost done";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Check TikTok authentication status on mount
  useEffect(() => {
    checkTikTokAuth();
  }, []);
  const checkTikTokAuth = async () => {
    setIsCheckingTikTokAuth(true);
    try {
      const {
        data,
        error
      } = await supabase.from('tiktok_credentials').select('expires_at').single();
      if (!error && data) {
        const expiresAt = new Date(data.expires_at);
        setIsTikTokConnected(expiresAt > new Date());
      } else {
        setIsTikTokConnected(false);
      }
    } catch (err) {
      setIsTikTokConnected(false);
    } finally {
      setIsCheckingTikTokAuth(false);
    }
  };
  const connectTikTok = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('tiktok-auth');
      if (error) throw error;
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank');
        toast.info("Please complete TikTok authorization in the new window");

        // Check auth status after a delay
        setTimeout(() => checkTikTokAuth(), 3000);
      }
    } catch (error: any) {
      console.error('TikTok auth error:', error);
      toast.error(error.message || "Failed to connect to TikTok");
    }
  };
  const publishToTikTok = async () => {
    if (!videoPath) {
      toast.error("No video available to publish");
      return;
    }
    if (!isTikTokConnected) {
      toast.error("Please connect to TikTok first");
      return;
    }

    // Get title from first title variation or use default
    const title = titleVariations[0] || "My Video";
    const description = summaries[0] || "";
    setIsPublishingToTikTok(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('publish-to-tiktok', {
        body: {
          videoPath,
          title,
          description
        }
      });
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      toast.success("Video published to TikTok successfully!");
    } catch (error: any) {
      console.error('TikTok publish error:', error);
      toast.error(error.message || "Failed to publish to TikTok");
    } finally {
      setIsPublishingToTikTok(false);
    }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitleBlobUrl) return;
    try {
      video.load();
    } catch {}
    const showTracks = () => {
      const tracks = video.textTracks;
      console.log('[KyrgyzSubtitleGenerator] textTracks count:', tracks.length);
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'showing';
        console.log('[KyrgyzSubtitleGenerator] set track', i, 'mode to', tracks[i].mode, 'cues:', tracks[i].cues?.length ?? 0);
      }
    };
    video.addEventListener('loadeddata', showTracks, {
      once: true
    } as any);
    const t = trackRef.current;
    if (t) t.addEventListener('load', showTracks, {
      once: true
    } as any);
    const id = setTimeout(showTracks, 800);
    return () => {
      video.removeEventListener('loadeddata', showTracks as any);
      if (t) t.removeEventListener('load', showTracks as any);
      clearTimeout(id);
    };
  }, [subtitleBlobUrl, captionStyle]);
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
      // Estimate: typical video processing takes ~120 seconds
      // Progress curve: fast at start, slows down near end
      const estimatedTotal = 120;
      let progress = Math.min(elapsed / estimatedTotal * 100, 95);

      // Apply curve: progress faster in early stages
      if (progress < 50) {
        progress = progress * 1.2;
      }
      setProcessingProgress(Math.min(progress, 95));

      // Calculate estimated time remaining
      const timeRemaining = Math.max(estimatedTotal - elapsed, 0);
      setEstimatedTimeRemaining(timeRemaining);
    }, 500);
    return () => clearInterval(interval);
  }, [isProcessingVideo, processingStartTime]);
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error("Please select a video file");
      return;
    }

    // Validate file size (max 200MB)
    const MAX_SIZE = 200 * 1024 * 1024; // 200MB
    if (file.size > MAX_SIZE) {
      toast.error(`Video file must be less than 200MB (current: ${Math.round(file.size / 1024 / 1024)}MB). Please compress your video.`);
      return;
    }

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
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress based on file size
    const simulateProgress = () => {
      const fileSize = file.size;
      // Estimate ~1.5s per MB, cap at 5 minutes for very large files
      const estimatedTime = Math.min((fileSize / (1024 * 1024)) * 1500, 300000);
      const interval = 200; // update less frequently to reduce jank
      const increment = (100 / (estimatedTime / interval)) * 1.4; // slightly faster at start

      const timer = setInterval(() => {
        setUploadProgress((prev) => {
          // Ramp to 95 normally, then "trickle" slowly up to 99% while finalizing
          if (prev < 95) {
            return Math.min(prev + increment, 95);
          }
          // Trickle at ~0.05% per tick while waiting for the real upload to finish
          return Math.min(prev + 0.05, 99);
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
      
      console.log('[Upload] Starting upload:', fileName, 'Size:', file.size, 'bytes');
      
      // Add timeout wrapper for upload
      const uploadPromise = supabase.storage.from('videos').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

      // Set timeout based on file size: 30s base + 10s per MB (more generous for phone uploads)
      const timeoutMs = 30000 + (file.size / (1024 * 1024)) * 10000;
      console.log('[Upload] Timeout set to:', Math.round(timeoutMs / 1000), 'seconds');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timeout - please check your connection and try again')), timeoutMs)
      );

      // Fallback: if the SDK upload promise hangs, poll storage to detect if the file actually exists
      const pollFileExists = async (): Promise<'exists'> => {
        const folder = fileName.split('/')[0];
        const target = fileName.split('/').pop();
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          try {
            const { data } = await supabase.storage.from('videos').list(folder);
            if (data?.some((o: any) => o.name === target)) {
              console.log('[Upload] File detected in storage via polling');
              return 'exists';
            }
          } catch (e) {
            // ignore transient errors and keep polling
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        throw new Error('Upload verification timed out');
      };

      const existsPromise = pollFileExists();

      const winner: any = await Promise.race([uploadPromise, existsPromise, timeoutPromise]);

      clearInterval(progressTimer);
      setUploadProgress(100);

      // If the race winner is the polling result, treat as success; otherwise check SDK response error
      if (winner !== 'exists' && winner?.error) {
        throw winner.error;
      }

      console.log('[Upload] Upload completed (winner):', winner);

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
      await generateSubtitlesForPath(fileName);
    } catch (error: any) {
      console.error("[Upload] Upload failed:", error);
      console.error("[Upload] Error details:", {
        message: error.message,
        status: error.status,
        statusCode: error.statusCode
      });
      
      // Always clear progress timer on error
      clearInterval(progressTimer);
      setIsUploading(false);
      setUploadProgress(0);
      
      // Provide helpful error message
      let errorMessage = "Failed to upload video";
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        errorMessage = "Upload timed out. Please check your internet connection and try again with a smaller video.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };
  const generateSubtitlesForPath = async (path: string) => {
    if (!path) {
      toast.error("Please upload a video first");
      return;
    }
    setIsGenerating(true);
    let responseData: any = null;
    try {
      console.log('[KyrgyzSubtitleGenerator] Calling edge function with videoPath:', path, 'addEmojis:', addEmojis, 'correctSpelling:', correctSpelling);
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-kyrgyz-subtitles', {
        body: {
          videoPath: path,
          addEmojis: addEmojis,
          correctSpelling: correctSpelling
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
      setSubtitles(data.subtitles);
      setEditedSubtitles(data.subtitles);
      setHasUnsavedChanges(false);
      setTranscription(data.transcription);
      setParsedCues(parseSrtToCues(data.subtitles));

      // Convert SRT to WebVTT format for video player
      const webvtt = convertSrtToWebVtt(data.subtitles);
      console.log('[KyrgyzSubtitleGenerator] WebVTT preview:', webvtt.substring(0, 200));
      const blob = new Blob([webvtt], {
        type: 'text/vtt'
      });
      const blobUrl = URL.createObjectURL(blob);
      setSubtitleBlobUrl(blobUrl);
      console.log('[KyrgyzSubtitleGenerator] Subtitles generated, cues:', parsedCues.length);
      toast.success("Kyrgyz subtitles generated successfully");

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
      console.error("[KyrgyzSubtitleGenerator] Full error:", error);
      console.error("[KyrgyzSubtitleGenerator] Error context:", {
        message: error.message,
        context: error.context
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
    // Robust SRT -> WebVTT conversion: remove numeric cue IDs and fix timestamps
    const normalized = srt.replace(/\r+/g, '').trim();
    const cues = normalized.split('\n\n').map(block => {
      const lines = block.split('\n');
      // Remove numeric cue identifier if present
      if (/^\d+$/.test(lines[0])) {
        lines.shift();
      }
      return lines.join('\n');
    }).join('\n\n');
    const withDots = cues.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
    return 'WEBVTT\n\n' + withDots;
  };
  const parseSrtToCues = (srt: string) => {
    const normalized = srt.replace(/\r+/g, '').trim();
    const blocks = normalized.split('\n\n');
    const cues: Array<{
      start: number;
      end: number;
      text: string;
    }> = [];
    for (const block of blocks) {
      const lines = block.split('\n');
      if (!lines.length) continue;
      if (/^\d+$/.test(lines[0])) lines.shift();
      const timing = lines.shift() || '';
      const m = timing.match(/(\d+:\d+:\d+)[,.](\d+)\s+-->\s+(\d+:\d+:\d+)[,.](\d+)/);
      if (!m) continue;
      const start = hmsToSeconds(m[1], m[2]);
      const end = hmsToSeconds(m[3], m[4]);
      const text = lines.join('\n');
      cues.push({
        start,
        end,
        text
      });
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
    const blob = new Blob([webvtt], {
      type: 'text/vtt'
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
    if (!videoUrl || !subtitles || !videoPath) {
      toast.error("No video or subtitles available");
      return;
    }
    setIsProcessingVideo(true);
    setProcessingStatus('starting');
    setProcessingProgress(0);
    setProcessingStartTime(Date.now());
    try {
      console.log('[KyrgyzSubtitleGenerator] Calling backend burn-subtitles function...');
      toast.info("Processing started. This may take several minutes...");

      // Start the processing job; backend returns a predictionId for polling
      const {
        data,
        error
      } = await supabase.functions.invoke('burn-subtitles-backend', {
        body: {
          videoPath,
          subtitles,
          stylePrompt: currentStyle.prompt
        }
      });
      if (error) throw error;

      // New flow: poll by predictionId
      if (data?.predictionId) {
        const predictionId: string = data.predictionId;
        for (let attempt = 0; attempt < 120; attempt++) {
          // ~10 minutes max
          await new Promise(res => setTimeout(res, 5000));
          const {
            data: statusData,
            error: statusError
          } = await supabase.functions.invoke('burn-subtitles-backend', {
            body: {
              predictionId
            }
          });
          if (statusError) throw statusError;
          if (statusData?.status) setProcessingStatus(statusData.status);
          if (statusData?.videoUrl) {
            // Completed successfully – set to 100%
            setProcessingProgress(100);
            // Completed successfully – download
            const processedVideoBlob = await fetch(statusData.videoUrl).then(r => r.blob());
            const videoLink = document.createElement('a');
            videoLink.href = window.URL.createObjectURL(processedVideoBlob);
            videoLink.download = 'video_with_subtitles.mp4';
            document.body.appendChild(videoLink);
            videoLink.click();
            document.body.removeChild(videoLink);
            window.URL.revokeObjectURL(videoLink.href);
            toast.success("Video with burned subtitles downloaded successfully!");
            return;
          }
        }
        throw new Error("Processing timed out. Please try again later.");
      }

      // Backward-compatibility: if backend returns the URL directly
      if (data?.success && data?.videoUrl) {
        const processedVideoBlob = await fetch(data.videoUrl).then(r => r.blob());
        const videoLink = document.createElement('a');
        videoLink.href = window.URL.createObjectURL(processedVideoBlob);
        videoLink.download = 'video_with_subtitles.mp4';
        document.body.appendChild(videoLink);
        videoLink.click();
        document.body.removeChild(videoLink);
        window.URL.revokeObjectURL(videoLink.href);
        toast.success("Video with burned subtitles downloaded successfully!");
        return;
      }
      throw new Error(data?.error || "Failed to start video processing");
    } catch (error: any) {
      console.error('[KyrgyzSubtitleGenerator] Backend processing failed:', error);
      toast.error("Processing failed: " + (error?.message || 'Unknown error'));
    } finally {
      setIsProcessingVideo(false);
      setProcessingStatus('');
      setProcessingProgress(0);
      setProcessingStartTime(0);
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
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Kyrgyz Video Subtitle Generator</CardTitle>
          <CardDescription>Upload a video and generate Kyrgyz subtitles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
            {isUploading && (
              <div className="w-full space-y-1">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-muted-foreground">
                  {uploadProgress < 95 
                    ? "Uploading and generating captions... This may take a few minutes for large files."
                    : "Finalizing upload and caption generation... Large files on mobile can take a few minutes."}
                </p>
              </div>
            )}
          </div>

          {/* Caption Style Selector */}
          {videoUrl && subtitles && <div className="space-y-2">
              <label className="text-sm font-semibold">Caption Style</label>
              <div className="grid grid-cols-4 gap-2">
                {captionStyles.map(style => {
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
                {/* Spelling Correction Toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div className="space-y-0.5">
                    <Label htmlFor="spelling-toggle" className="text-sm font-medium">
                      ✓ Correct Spelling
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {subtitles ? correctSpelling ? "Spelling correction ON — click Regenerate to apply" : "Turn on and click Regenerate to correct spelling" : correctSpelling ? "Spelling will be corrected on generation" : "Fix spelling mistakes in Kyrgyz text"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="spelling-toggle" checked={correctSpelling} onCheckedChange={setCorrectSpelling} />
                    {subtitles && <Button size="sm" variant="secondary" onClick={() => videoPath && generateSubtitlesForPath(videoPath)} disabled={isGenerating}>
                        {isGenerating ? 'Regenerating...' : 'Regenerate'}
                      </Button>}
                  </div>
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
                    {subtitles && <Button size="sm" variant="secondary" onClick={() => videoPath && generateSubtitlesForPath(videoPath)} disabled={isGenerating}>
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
                     <div className="flex gap-2">
                       {hasUnsavedChanges && <Button onClick={applySubtitleChanges} className="flex-1">
                           Update Captions
                         </Button>}
                       <Button onClick={downloadVideoWithSubtitles} size="lg" className={`
                        ${hasUnsavedChanges ? "flex-1" : "w-full"}
                        bg-blue-600 hover:bg-blue-700
                        text-white font-semibold
                        shadow-lg hover:shadow-xl
                        transition-all duration-300
                      `} disabled={isProcessingVideo}>
                      {isProcessingVideo ? <div className="w-full space-y-2">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="text-sm">
                                {processingStatus} - {Math.round(processingProgress)}%
                                {estimatedTimeRemaining > 0 && ` • ~${formatTimeRemaining(estimatedTimeRemaining)} left`}
                              </span>
                            </div>
                            <Progress value={processingProgress} className="w-full h-2" />
                          </div> : <>
                          <div className="flex items-center gap-2">
                            <Download className="w-5 h-5" />
                            <span>Download Video

                        </span>
                          </div>
                         </>}
                     </Button>
                     </div>
                     
                     {/* TikTok Publishing */}
                     <div className="flex gap-2">
                       {!isTikTokConnected ? <Button onClick={connectTikTok} disabled={isCheckingTikTokAuth} className="w-full bg-gradient-to-r from-[#00f2ea] to-[#ff0050] hover:opacity-90 text-white font-semibold shadow-lg" size="lg">
                           {isCheckingTikTokAuth ? <>
                               <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                               Checking...
                             </> : <>
                               <Share2 className="w-5 h-5 mr-2" />
                               Export to TikTok
                             </>}
                         </Button> : <Button onClick={publishToTikTok} disabled={isPublishingToTikTok} className="w-full bg-gradient-to-r from-[#00f2ea] to-[#ff0050] hover:opacity-90 text-white font-semibold shadow-lg" size="lg">
                           {isPublishingToTikTok ? <>
                               <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                               Exporting...
                             </> : <>
                               <Share2 className="w-5 h-5 mr-2" />
                               Export to TikTok
                             </>}
                         </Button>}
                     </div>
                   </div>
                 </div>}
              </div>

              {/* Right side - Video Player */}
              <div className="space-y-2">
                <div className="p-2 h-[800px] flex flex-col">
                  <div className="flex-1 flex items-center justify-center overflow-auto">
                    <video key={subtitleBlobUrl || 'no-vtt'} ref={videoRef} src={videoUrl} controls className="rounded max-w-full max-h-full object-contain" crossOrigin="anonymous" onLoadedMetadata={() => {
                  if (videoRef.current) {
                    const tracks = videoRef.current.textTracks;
                    for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'showing';
                  }
                }} onLoadedData={() => {
                  if (videoRef.current) {
                    const tracks = videoRef.current.textTracks;
                    for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'showing';
                  }
                }}>
                      {subtitleBlobUrl && <track kind="captions" src={subtitleBlobUrl} srcLang="ky" label="Kyrgyz" default ref={trackRef} />}
                    </video>
                  </div>
                </div>

                {isGenerating && !subtitles && <div className="flex items-center justify-center p-3 border rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Generating Kyrgyz subtitles...</span>
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

    {/* How it works section */}
    {transcription && <Card className="max-w-4xl mx-auto mt-6">
      <CardHeader>
        <CardTitle className="text-lg">How Editing Works</CardTitle>
        <CardDescription>See an example of the subtitle editing interface</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg overflow-hidden border">
          <img src={editingExample} alt="Example of subtitle editing interface showing caption styles, emoji toggle, subtitle editor, and video preview" className="w-full h-auto" />
        </div>
      </CardContent>
    </Card>}
    </>;
};
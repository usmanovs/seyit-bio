import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Download, Video } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  const [captionStyle, setCaptionStyle] = useState<string>('outline');
  const [addEmojis, setAddEmojis] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLTrackElement>(null);
  const subtitleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const captionStyles = [{
    id: 'outline',
    name: 'Outline',
    css: 'background-color: transparent; color: white; font-weight: bold; text-shadow: -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000;',
    prompt: 'white text with extra thick black outline, no background, bold font, very high contrast'
  }, {
    id: 'minimal',
    name: 'Minimal',
    css: 'background-color: rgba(0, 0, 0, 0.5); color: white; font-weight: normal; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);',
    prompt: 'white text, normal weight, semi-transparent black background, minimal shadow'
  }, {
    id: 'green',
    name: 'Green',
    css: 'background-color: rgb(34, 197, 94); color: white; font-weight: bold; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);',
    prompt: 'white text on bright green background, bold font, with dark shadow for readability'
  }, {
    id: 'boxed',
    name: 'Boxed',
    css: 'background-color: rgba(0, 0, 0, 0.9); color: white; font-weight: bold; border: 3px solid white; text-shadow: none;',
    prompt: 'white text with white border box, bold font, solid black background'
  }];
  const currentStyle = captionStyles.find(s => s.id === captionStyle) || captionStyles[0];
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

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video file must be less than 100MB");
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
      const estimatedTime = Math.min(fileSize / (1024 * 1024) * 1000, 30000); // ~1s per MB, max 30s
      const interval = 100;
      const increment = 100 / (estimatedTime / interval) * 1.5; // Faster at start

      const timer = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + increment;
          if (next >= 95) {
            clearInterval(timer);
            return 95; // Stop at 95%, complete when upload finishes
          }
          return next;
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
      const {
        error: uploadError
      } = await supabase.storage.from('videos').upload(fileName, file);
      clearInterval(progressTimer);
      setUploadProgress(100);
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('videos').getPublicUrl(fileName);
      setVideoUrl(publicUrl);
      setVideoPath(fileName);
      toast.success("Video uploaded successfully");

      // Auto-generate subtitles after upload
      await generateSubtitlesForPath(fileName);
    } catch (error: any) {
      console.error("Error uploading video:", error);
      toast.error(error.message || "Failed to upload video");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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
      console.log('[KyrgyzSubtitleGenerator] Calling edge function with videoPath:', path, 'addEmojis:', addEmojis);
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-kyrgyz-subtitles', {
        body: {
          videoPath: path,
          addEmojis: addEmojis
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
  return <>
      <style>{`
        video::cue {
          ${currentStyle.css}
          font-size: 1.5em;
          padding: 0.2em 0.5em;
          border-radius: 4px;
        }
      `}</style>
      <Card>
        <CardHeader>
          <CardTitle>Kyrgyz Video Subtitle Generator</CardTitle>
          <CardDescription>Upload a video and generate Kyrgyz subtitles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full">
              {isUploading ? <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading... {uploadProgress}%
                </> : <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Video
                </>}
            </Button>
            {isUploading && <Progress value={uploadProgress} className="w-full" />}
          </div>

          {/* Caption Style Selector */}
          {videoUrl && subtitles && <div className="space-y-2">
              <label className="text-sm font-semibold">Caption Style</label>
              <div className="grid grid-cols-3 gap-2">
                {captionStyles.map(style => {
              const getStyleClasses = () => {
                switch (style.id) {
                  case 'default':
                    return 'bg-black text-white font-bold shadow-[0_0_10px_rgba(255,215,0,0.8)]';
                  case 'outline':
                    return 'bg-gray-900 text-white font-bold';
                  case 'minimal':
                    return 'bg-black/60 text-white font-normal shadow-sm';
                  case 'green':
                    return 'bg-green-600 text-white font-bold shadow-md';
                  case 'boxed':
                    return 'bg-black text-white font-bold border-2 border-white shadow-lg';
                  default:
                    return '';
                }
              };
              return <button key={style.id} onClick={() => setCaptionStyle(style.id)} className={`p-4 rounded-lg transition-all text-base relative ${getStyleClasses()} ${captionStyle === style.id ? 'ring-4 ring-primary ring-offset-2 ring-offset-background scale-105' : 'hover:scale-102'}`}>
                      {style.name}
                    </button>;
            })}
              </div>
            </div>}

          {videoUrl && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left side - Controls and Subtitle Editor */}
              <div className="space-y-3">
                {/* Emoji Toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div className="space-y-0.5">
                    <Label htmlFor="emoji-toggle" className="text-sm font-medium">
                      Add Emojis to Captions
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {subtitles
                        ? (addEmojis
                            ? "Emojis ON — click Regenerate to apply to current captions"
                            : "Turn on and click Regenerate to apply to current captions")
                        : (addEmojis
                            ? "Emojis will be added on generation"
                            : "Enhance captions with relevant emojis")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="emoji-toggle"
                      checked={addEmojis}
                      onCheckedChange={setAddEmojis}
                    />
                    {subtitles && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => videoPath && generateSubtitlesForPath(videoPath)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? 'Regenerating...' : 'Regenerate'}
                      </Button>
                    )}
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
                  <div className="flex gap-2">
                    {hasUnsavedChanges && <Button onClick={applySubtitleChanges} className="flex-1">
                        Update Captions
                      </Button>}
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
                      disabled={isProcessingVideo}
                    >
                      {isProcessingVideo ? <div className="w-full space-y-2">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="text-sm">{processingStatus} - {Math.round(processingProgress)}%</span>
                            </div>
                            <Progress value={processingProgress} className="w-full h-2" />
                          </div> : <>
                          <div className="flex items-center gap-2">
                            <Download className="w-5 h-5" />
                            <span>Download Video + SRT</span>
                          </div>
                        </>}
                    </Button>
                  </div>
                </div>}
              </div>

              {/* Right side - Video Player */}
              <div className="space-y-2">
                <div className="p-2 h-[650px] flex flex-col">
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
    </>;
};
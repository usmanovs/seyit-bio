import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, Loader2, FileVideo, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export const VideoSubtitleGenerator = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [srtContent, setSrtContent] = useState("");
  const [videoInfo, setVideoInfo] = useState<{ language: string; duration: number } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [isOpen, setIsOpen] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      
      // Show warning for MOV files
      if (fileExtension === 'mov') {
        toast.error("MOV format is not supported. Please convert to MP4 first using a free converter like CloudConvert or HandBrake.");
        return;
      }
      
      // Check file size (max 25MB for Whisper API)
      if (selectedFile.size > 25 * 1024 * 1024) {
        toast.error("File size must be less than 25MB");
        return;
      }
      
      // Clean up previous video/subtitle URLs
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      if (vttUrl) {
        URL.revokeObjectURL(vttUrl);
        setVttUrl(null);
      }
      
      // Create new video URL
      const newVideoUrl = URL.createObjectURL(selectedFile);
      setVideoUrl(newVideoUrl);
      setFile(selectedFile);
      
      // Reset previous results
      setTranscription("");
      setSrtContent("");
      setVideoInfo(null);
    }
  };

  const generateSubtitles = async () => {
    if (!file) {
      toast.error("Please select a video file");
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedLanguage !== 'auto') {
        formData.append('language', selectedLanguage);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-subtitles`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate subtitles');
      }

      const data = await response.json();
      
      setTranscription(data.text);
      setSrtContent(data.srt);
      
      // Create blob URL for VTT content (convert from SRT) to handle Unicode characters
      if (vttUrl) {
        URL.revokeObjectURL(vttUrl);
      }
      const styleHeader = `WEBVTT

STYLE
::cue { font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'EmojiOne Color', 'Segoe UI Symbol', 'Symbola', ui-sans-serif, system-ui, sans-serif; font-size: 1.1em; line-height: 1.35; }

`;
      const vttText = styleHeader + String(data.srt || '')
        .replace(/\r+/g, '')
        .replace(/^\d+\s*$/gm, '')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
      const vttBlob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
      const newVttUrl = URL.createObjectURL(vttBlob);
      setVttUrl(newVttUrl);
      
      setVideoInfo({
        language: data.language,
        duration: data.duration
      });

      toast.success("Subtitles generated successfully!");
    } catch (error: any) {
      console.error("Error generating subtitles:", error);
      toast.error(error.message || "Failed to generate subtitles");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSRT = () => {
    if (!srtContent) return;

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.[^/.]+$/, '')}_kyrgyz.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Subtitle file downloaded!");
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="w-full">
        <CardHeader>
          <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
            <div className="flex flex-col items-start gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileVideo className="w-5 h-5" />
                Multi-Language Video Subtitle Generator
              </CardTitle>
              <CardDescription>
                Upload a video file and generate subtitles in multiple languages (SRT format)
              </CardDescription>
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
        {/* Language Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Subtitle Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={isProcessing}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          >
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
            <option value="tr">Turkish</option>
            <option value="kk">Kazakh</option>
            <option value="uz">Uzbek</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Note: Kyrgyz is not supported by the transcription service. Kazakh is the closest available option.
          </p>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Select Video File (Max 25MB)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.oga,.ogg,.wav,.webm,.mov"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload"
              disabled={isProcessing}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('video-upload')?.click()}
              disabled={isProcessing}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {file ? file.name : "Choose Video File"}
            </Button>
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              File size: {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateSubtitles}
          disabled={!file || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing... This may take a few minutes
            </>
          ) : (
            <>
              <FileVideo className="w-4 h-4 mr-2" />
              Generate Kyrgyz Subtitles
            </>
          )}
        </Button>

        {/* Video Info */}
        {videoInfo && (
          <div className="p-3 bg-muted/30 rounded-lg space-y-1">
            <p className="text-sm">
              <strong>Language:</strong> {videoInfo.language === 'ky' ? 'Kyrgyz' : videoInfo.language}
            </p>
            <p className="text-sm">
              <strong>Duration:</strong> {Math.floor(videoInfo.duration / 60)}:{String(Math.floor(videoInfo.duration % 60)).padStart(2, '0')}
            </p>
          </div>
        )}

        {/* Transcription Display */}
        {transcription && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Full Transcription
            </label>
            <Textarea
              value={transcription}
              readOnly
              className="min-h-[150px] font-mono text-sm"
            />
          </div>
        )}

        {/* SRT Preview */}
        {srtContent && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              SRT Subtitle Preview
            </label>
            <Textarea
              value={srtContent}
              readOnly
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        )}

        {/* Video Player */}
        {videoUrl && vttUrl && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Video Preview with Subtitles
            </label>
            <video
              controls
              crossOrigin="anonymous"
              className="w-full max-w-2xl mx-auto rounded-lg"
              src={videoUrl}
              ref={(video) => {
                if (video) {
                  // Enable subtitles when video loads
                  video.addEventListener('loadedmetadata', () => {
                    const tracks = video.textTracks;
                    if (tracks.length > 0) {
                      tracks[0].mode = 'showing';
                      console.log('Subtitle track enabled:', tracks[0]);
                    }
                  });
                  
                  // Also try to enable immediately if already loaded
                  if (video.readyState >= 1 && video.textTracks.length > 0) {
                    video.textTracks[0].mode = 'showing';
                  }
                }
              }}
            >
              <track
                kind="subtitles"
                label="Kyrgyz"
                srcLang="ky"
                src={vttUrl}
                default
                onLoad={(e) => {
                  console.log('Track loaded successfully');
                  const track = e.currentTarget.track;
                  if (track) {
                    track.mode = 'showing';
                  }
                }}
                onError={(e) => {
                  console.error('Track loading error:', e);
                  toast.error('Could not load subtitles');
                }}
              />
              Your browser does not support the video tag.
            </video>
            <p className="text-xs text-muted-foreground text-center">
              Subtitles should appear on the video. If not visible, check your browser's subtitle settings (CC button).
            </p>
          </div>
        )}

        {/* Download Button */}
        {srtContent && (
          <Button
            onClick={downloadSRT}
            variant="default"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download SRT Subtitle File
          </Button>
        )}

        {/* Usage Instructions */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p><strong>Supported formats:</strong> FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WEBM</p>
          <p><strong>Note:</strong> MOV files are not supported - convert to MP4 first</p>
          <p><strong>Language:</strong> Automatically transcribes in Kyrgyz</p>
          <p><strong>Output:</strong> SRT subtitle file with timestamps</p>
        </div>
      </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

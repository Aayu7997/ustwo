import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Globe, FileVideo } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface MediaSource {
  type: 'local' | 'url' | 'ott';
  url?: string;
  file?: File;
  title?: string;
}

interface MediaSourceSelectorProps {
  onMediaSelect: (source: MediaSource) => void;
  roomId: string;
}

export const MediaSourceSelector: React.FC<MediaSourceSelectorProps> = ({
  onMediaSelect,
  roomId
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleLocalFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    onMediaSelect({
      type: 'local',
      url,
      file,
      title: file.name
    });
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleLocalFile(file);
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid video URL",
        variant: "destructive"
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
      return;
    }

    onMediaSelect({
      type: 'url',
      url: urlInput,
      title: extractTitleFromUrl(urlInput)
    });
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'Video';
      return filename.replace(/\.[^/.]+$/, ''); // Remove extension
    } catch {
      return 'Video';
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      handleLocalFile(videoFile);
    } else {
      toast({
        title: "No video file found",
        description: "Please drop a video file",
        variant: "destructive"
      });
    }
  };

  const openExtensionPopup = () => {
    const extensionId = 'your-extension-id'; // Replace with actual extension ID
    const width = 400;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    window.open(
      `/popup.html?roomId=${roomId}`,
      'extensionPopup',
      `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no`
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="w-5 h-5" />
          Choose Your Media Source
        </CardTitle>
        <CardDescription>
          Select how you want to watch together - local files, streaming links, or OTT platforms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="local" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="local" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Local File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              Paste URL
            </TabsTrigger>
            <TabsTrigger value="ott" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              OTT Sync
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Drop your video file here
                </h3>
                <p className="text-muted-foreground mb-4">
                  Or click to browse your files
                </p>
                <Label htmlFor="file-input">
                  <Button variant="outline" className="cursor-pointer">
                    Choose File
                  </Button>
                </Label>
                <Input
                  id="file-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
              
              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-primary/5 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2">
                    <FileVideo className="w-5 h-5 text-primary" />
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </motion.div>
              )}
              
              <div className="text-sm text-muted-foreground">
                <p>• Supported formats: MP4, WebM, AVI, MOV</p>
                <p>• Your file stays on your device - it's not uploaded</p>
                <p>• Both partners need the same file for sync</p>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="video-url"
                    placeholder="https://example.com/video.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  />
                  <Button onClick={handleUrlSubmit}>
                    Load Video
                  </Button>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Paste direct video links (.mp4, .webm, .m3u8)</p>
                <p>• Google Drive sharing links (public videos)</p>
                <p>• YouTube, Vimeo, and other streaming URLs</p>
                <p>• Live streaming links (HLS/DASH)</p>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Some platforms may block external access. 
                  For best results, use direct video file links.
                </p>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="ott" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto">
                  <Globe className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold">
                  Sync with OTT Platforms
                </h3>
                <p className="text-muted-foreground">
                  Use our Chrome extension to sync with Netflix, Prime Video, YouTube, and more
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mx-auto">
                    <span className="text-red-600 dark:text-red-400 font-bold text-lg">N</span>
                  </div>
                  <p className="text-sm font-medium">Netflix</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">P</span>
                  </div>
                  <p className="text-sm font-medium">Prime Video</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mx-auto">
                    <span className="text-red-600 dark:text-red-400 font-bold text-lg">Y</span>
                  </div>
                  <p className="text-sm font-medium">YouTube</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">H</span>
                  </div>
                  <p className="text-sm font-medium">Hotstar</p>
                </div>
              </div>
              
              <Button
                onClick={openExtensionPopup}
                className="w-full"
                size="lg"
              >
                Open Extension Control
              </Button>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Install the UsTwo Chrome Extension first</p>
                <p>• Open your OTT platform in another tab</p>
                <p>• Use the extension to connect and sync</p>
                <p>• Only one partner needs a subscription</p>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
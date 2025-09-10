
import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileVideo, X, Play, Share, Cloud, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSharedFiles } from '@/hooks/useSharedFiles';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

interface FileUploadHandlerProps {
  roomId: string;
  onFileSelect: (file: File, url: string) => void;
  onUrlSubmit: (url: string) => void;
  onSharedFileSelect: (fileId: string, url: string, fileName: string) => void;
  maxFileSize?: number;
}

export const FileUploadHandler: React.FC<FileUploadHandlerProps> = ({
  roomId,
  onFileSelect,
  onUrlSubmit,
  onSharedFileSelect,
  maxFileSize = 500
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    sharedFiles, 
    uploading, 
    uploadProgress, 
    uploadFile, 
    getStreamingUrl 
  } = useSharedFiles(roomId);

  const {
    connected: driveConnected,
    loading: driveLoading,
    driveFiles,
    connectGoogleDrive,
    fetchDriveFiles
  } = useGoogleDrive();

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a video or audio file (MP4, WebM, AVI, MOV, MP3, WAV)",
        variant: "destructive"
      });
      return false;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxFileSize}MB. Your file is ${fileSizeMB.toFixed(1)}MB`,
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!validateFile(file)) return;

    setSelectedFile(file);
    
    // Create local URL for immediate playback
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
    }
    
    const localUrl = URL.createObjectURL(file);
    setLocalFileUrl(localUrl);
    onFileSelect(file, localUrl);

    toast({
      title: "File ready! 🎬",
      description: `${file.name} is loaded and ready to play locally. Upload to share with your partner.`,
    });
  }, [onFileSelect, maxFileSize, localFileUrl]);

  const handleUploadToCloud = async () => {
    if (!selectedFile) return;

    const uploadedFile = await uploadFile(selectedFile);
    if (uploadedFile) {
      const streamingUrl = await getStreamingUrl(uploadedFile.storage_path);
      if (streamingUrl) {
        onSharedFileSelect(uploadedFile.id, streamingUrl, uploadedFile.file_name);
        toast({
          title: "File shared! 💕",
          description: `${uploadedFile.file_name} is now available for your partner`
        });
      }
    }
  };

  const handleSharedFileSelect = async (fileId: string, fileName: string, storagePath: string) => {
    const streamingUrl = await getStreamingUrl(storagePath);
    if (streamingUrl) {
      onSharedFileSelect(fileId, streamingUrl, fileName);
      toast({
        title: "Shared file loaded! 💕",
        description: `Now watching ${fileName} together`,
      });
    } else {
      toast({
        title: "Error loading file",
        description: "Could not access the shared file",
        variant: "destructive"
      });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const mediaFile = files.find(file => 
      file.type.startsWith('video/') || file.type.startsWith('audio/')
    );

    if (mediaFile) {
      handleFileSelect(mediaFile);
    } else {
      toast({
        title: "No media file found",
        description: "Please drop a video or audio file",
        variant: "destructive"
      });
    }
  }, [handleFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type, file.size);
      handleFileSelect(file);
    }
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) {
      toast({
        title: "URL required",
        description: "Please enter a valid media URL",
        variant: "destructive"
      });
      return;
    }

    try {
      new URL(url);
      onUrlSubmit(url);
      setUrlInput('');
      toast({
        title: "URL loaded",
        description: "Media URL is ready for playback",
      });
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive"
      });
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
      setLocalFileUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="w-5 h-5" />
            Media Upload & Sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Drive Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
              </svg>
              Google Drive Integration
            </Label>
            
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <div className="space-y-3">
                <svg className="w-12 h-12 mx-auto text-muted-foreground" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
                </svg>
                <h3 className="font-semibold">Google Drive Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Google Drive requires OAuth configuration in Supabase
                </p>
                <Button 
                  onClick={connectGoogleDrive}
                  disabled={driveLoading}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <ExternalLink className="w-4 h-4" />
                  {driveLoading ? 'Checking...' : 'Test Google Drive'}
                </Button>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Local File Upload</Label>
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
                Drop your media file here
              </h3>
              <p className="text-muted-foreground mb-4">
                Supports video and audio files - plays instantly!
              </p>
                <Button 
                  variant="outline" 
                  className="cursor-pointer" 
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </Button>
                <Input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept="video/*,audio/*"
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={uploading}
                />
            </div>

            {/* Upload Progress */}
            {uploading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <div className="flex justify-between text-sm">
                  <span>Uploading to share with partner...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </motion.div>
            )}

            {/* Selected File Display */}
            {selectedFile && !uploading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/5 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileVideo className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to play
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleUploadToCloud}
                      disabled={uploading}
                      className="flex items-center gap-1"
                    >
                      <Share className="w-4 h-4" />
                      Share
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Shared Files Section */}
          {sharedFiles.length > 0 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Shared Files ({sharedFiles.length})
              </Label>
              <div className="space-y-2">
                {sharedFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted/30 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <FileVideo className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.file_size / (1024 * 1024)).toFixed(2)} MB • Shared
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSharedFileSelect(file.id, file.file_name, file.storage_path)}
                      className="flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Play
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Media URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
              <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                Load
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>YouTube:</strong> youtube.com, youtu.be links (embedded player)</p>
              <p>• <strong>HLS Streams:</strong> .m3u8 live streams and VOD</p>
              <p>• <strong>Direct Video:</strong> .mp4, .webm, .mov files</p>
              <p>• <strong>Google Drive:</strong> Public drive.google.com sharing links</p>
              <p>• All URLs sync automatically between partners</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

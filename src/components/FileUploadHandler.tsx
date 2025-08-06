
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileVideo, X, Play, Share, Cloud } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useSharedFiles } from '@/hooks/useSharedFiles';

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

  const { 
    sharedFiles, 
    uploading, 
    uploadProgress, 
    uploadFile, 
    getStreamingUrl 
  } = useSharedFiles(roomId);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file (MP4, WebM, AVI, MOV)",
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
    const localUrl = URL.createObjectURL(file);
    setLocalFileUrl(localUrl);
    onFileSelect(file, localUrl);

    toast({
      title: "File ready for local playback! 🎬",
      description: `${file.name} is ready to play. Upload to share with your partner.`,
    });
  }, [onFileSelect, maxFileSize]);

  const handleUploadToCloud = async () => {
    if (!selectedFile) return;

    const uploadedFile = await uploadFile(selectedFile);
    if (uploadedFile) {
      const streamingUrl = await getStreamingUrl(uploadedFile.storage_path);
      if (streamingUrl) {
        onSharedFileSelect(uploadedFile.id, streamingUrl, uploadedFile.file_name);
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
    const videoFile = files.find(file => file.type.startsWith('video/'));

    if (videoFile) {
      handleFileSelect(videoFile);
    } else {
      toast({
        title: "No video file found",
        description: "Please drop a video file",
        variant: "destructive"
      });
    }
  }, [handleFileSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) {
      toast({
        title: "URL required",
        description: "Please enter a valid video URL",
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
        description: "Video URL is ready for playback",
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
    setLocalFileUrl(null);
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
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
                Drop your video file here
              </h3>
              <p className="text-muted-foreground mb-4">
                Play instantly locally, then share with your partner
              </p>
              <Label htmlFor="file-input">
                <Button variant="outline" className="cursor-pointer" disabled={uploading}>
                  Choose File
                </Button>
              </Label>
              <Input
                id="file-input"
                type="file"
                accept="video/*"
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
                  <span>Uploading to cloud...</span>
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
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to play locally
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
                      Share with Partner
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
                          {(file.file_size / (1024 * 1024)).toFixed(2)} MB • Shared by partner
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
                      Watch Together
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Video URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/video.mp4"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
              <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                Load URL
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Direct video links automatically sync between partners</p>
              <p>• YouTube, Vimeo, and streaming URLs supported</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

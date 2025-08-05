import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileVideo, X, Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FileUploadHandlerProps {
  onFileSelect: (file: File, url: string) => void;
  onUrlSubmit: (url: string) => void;
  maxFileSize?: number; // in MB
}

export const FileUploadHandler: React.FC<FileUploadHandlerProps> = ({
  onFileSelect,
  onUrlSubmit,
  maxFileSize = 500 // 500MB default
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a video file (MP4, WebM, AVI, MOV)",
        variant: "destructive"
      });
      return false;
    }

    // Check file size
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

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress for local files
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Create blob URL for local playback
      const url = URL.createObjectURL(file);
      
      setTimeout(() => {
        setUploadProgress(100);
        setSelectedFile(file);
        onFileSelect(file, url);
        
        toast({
          title: "File ready!",
          description: `${file.name} is ready for playback`,
        });
      }, 1000);

    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [onFileSelect, maxFileSize]);

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
    setUploadProgress(0);
    setUrlInput('');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="w-5 h-5" />
          Media Upload & URL
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
              Or click to browse (Max {maxFileSize}MB)
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
                <span>Processing file...</span>
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
              className="bg-primary/5 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <FileVideo className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">
                  <Play className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>

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
            <p>• Supported: Direct video links (.mp4, .webm, .m3u8)</p>
            <p>• YouTube, Vimeo, Google Drive (public), and streaming URLs</p>
          </div>
        </div>

        {/* Format Support Info */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Supported Formats:</p>
          <div className="grid grid-cols-2 gap-1">
            <p>• MP4, WebM, AVI</p>
            <p>• MOV, MKV, FLV</p>
            <p>• HLS (.m3u8)</p>
            <p>• DASH streams</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
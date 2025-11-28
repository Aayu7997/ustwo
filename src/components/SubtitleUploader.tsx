import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Upload, X, FileText, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SubtitleUploaderProps {
  roomId: string;
  onSubtitleUploaded: (subtitleUrl: string, format: 'srt' | 'vtt') => void;
}

export const SubtitleUploader: React.FC<SubtitleUploaderProps> = ({
  roomId,
  onSubtitleUploaded
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<{
    name: string;
    format: 'srt' | 'vtt';
    url: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'srt' && extension !== 'vtt') {
      toast({
        title: "Invalid File Format",
        description: "Please upload a .srt or .vtt subtitle file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileName = `${roomId}/${Date.now()}_${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(fileName, file, {
          contentType: file.type || 'text/plain',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(data.path);

      // Save reference in shared_files table
      await supabase.from('shared_files').insert({
        room_id: roomId,
        uploader_id: user.id,
        file_name: file.name,
        storage_path: data.path,
        file_size: file.size,
        mime_type: file.type || 'text/plain',
        upload_status: 'completed'
      });

      const subtitleData = {
        name: file.name,
        format: extension as 'srt' | 'vtt',
        url: urlData.publicUrl
      };

      setCurrentSubtitle(subtitleData);
      onSubtitleUploaded(subtitleData.url, subtitleData.format);

      // Broadcast to partners
      const channel = supabase.channel(`room_${roomId}`);
      await channel.send({
        type: 'broadcast',
        event: 'subtitle_uploaded',
        payload: subtitleData
      });

      toast({
        title: "Subtitles Uploaded",
        description: "Your partner can now see the subtitles too!"
      });
    } catch (error) {
      console.error('Error uploading subtitle:', error);
      toast({
        title: "Upload Failed",
        description: "Could not upload subtitle file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeSubtitle = () => {
    setCurrentSubtitle(null);
    onSubtitleUploaded('', 'srt');
    
    toast({
      title: "Subtitles Removed",
      description: "Subtitles have been disabled"
    });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Synchronized Subtitles</span>
            </div>
            {currentSubtitle && (
              <Badge variant="secondary" className="gap-1">
                <Check className="w-3 h-3" />
                Active
              </Badge>
            )}
          </div>

          {currentSubtitle ? (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentSubtitle.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">
                    {currentSubtitle.format} Format
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeSubtitle}
                className="shrink-0 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Subtitles (.srt or .vtt)
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Subtitles will be synchronized for both partners
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface SharedFile {
  id: string;
  room_id: string;
  uploader_id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  mime_type: string;
  upload_status: 'uploading' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export const useSharedFiles = (roomId: string) => {
  const { user } = useAuth();
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<SharedFile | null>(null);

  // Fetch shared files for the room
  const fetchSharedFiles = useCallback(async () => {
    if (!roomId || !user) return;

    try {
      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .eq('room_id', roomId)
        .eq('upload_status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Type cast to ensure proper type matching
      const typedFiles: SharedFile[] = (data || []).map(file => ({
        ...file,
        upload_status: file.upload_status as 'uploading' | 'completed' | 'failed'
      }));
      setSharedFiles(typedFiles);
    } catch (error) {
      console.error('Error fetching shared files:', error);
    }
  }, [roomId, user]);

  // Upload file to Supabase Storage
  const uploadFile = async (file: File): Promise<SharedFile | null> => {
    if (!user || !roomId) return null;

    setUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${roomId}/${fileName}`;

      // Create database record first
      const { data: fileRecord, error: dbError } = await supabase
        .from('shared_files')
        .insert({
          room_id: roomId,
          uploader_id: user.id,
          file_name: file.name,
          file_size: file.size,
          storage_path: filePath,
          mime_type: file.type,
          upload_status: 'uploading'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Upload to storage - simulate progress for now
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        setUploadProgress(Math.min(progress, 90));
      }, 200);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-media')
        .upload(filePath, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) {
        // Update status to failed
        await supabase
          .from('shared_files')
          .update({ upload_status: 'failed' })
          .eq('id', fileRecord.id);
        throw uploadError;
      }

      // Update status to completed
      const { data: updatedFile, error: updateError } = await supabase
        .from('shared_files')
        .update({ upload_status: 'completed' })
        .eq('id', fileRecord.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Type cast the updated file
      const typedUpdatedFile: SharedFile = {
        ...updatedFile,
        upload_status: updatedFile.upload_status as 'uploading' | 'completed' | 'failed'
      };

      setCurrentFile(typedUpdatedFile);
      toast({
        title: "File uploaded successfully! 💕",
        description: `${file.name} is now available for your partner to stream`,
      });

      return typedUpdatedFile;

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Get streaming URL for a shared file
  const getStreamingUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('shared-media')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting streaming URL:', error);
      return null;
    }
  };

  // Listen for real-time updates
  useEffect(() => {
    if (!roomId) return;

    fetchSharedFiles();

    const channel = supabase
      .channel(`shared_files_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_files',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('File update:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new.upload_status === 'completed') {
            const newFile: SharedFile = {
              ...payload.new as any,
              upload_status: payload.new.upload_status as 'uploading' | 'completed' | 'failed'
            };
            setSharedFiles(prev => [newFile, ...prev]);
            
            // Notify if uploaded by partner
            if (newFile.uploader_id !== user?.id) {
              toast({
                title: "New file shared! 💕",
                description: `${newFile.file_name} is now available to watch together`,
              });
            }
          }
          
          if (payload.eventType === 'UPDATE') {
            setSharedFiles(prev => 
              prev.map(file => {
                if (file.id === payload.new.id) {
                  return {
                    ...payload.new as any,
                    upload_status: payload.new.upload_status as 'uploading' | 'completed' | 'failed'
                  };
                }
                return file;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, fetchSharedFiles]);

  return {
    sharedFiles,
    currentFile,
    uploading,
    uploadProgress,
    uploadFile,
    getStreamingUrl,
    fetchSharedFiles,
    setCurrentFile
  };
};

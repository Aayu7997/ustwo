import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface MediaSyncState {
  time: number;
  isPlaying: boolean;
  mediaUrl: string | null;
  mediaType: string | null;
}

interface PendingSync {
  time: number;
  isPlaying: boolean;
  timestamp: number;
}

interface UseMediaSyncProps {
  roomId: string;
  onSyncReceived?: (state: MediaSyncState) => void;
}

export const useMediaSync = ({ roomId, onSyncReceived }: UseMediaSyncProps) => {
  const { user } = useAuth();
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const pendingSyncRef = useRef<PendingSync | null>(null);
  const lastAppliedRef = useRef<number>(0);
  const channelRef = useRef<any>(null);

  // Mark player as ready and apply pending sync
  const markPlayerReady = useCallback((applySync: (time: number, playing: boolean) => void) => {
    setIsPlayerReady(true);
    
    // Apply pending sync if exists
    if (pendingSyncRef.current) {
      const { time, isPlaying } = pendingSyncRef.current;
      console.log('[MediaSync] Applying pending sync:', { time, isPlaying });
      applySync(time, isPlaying);
      pendingSyncRef.current = null;
    }
  }, []);

  const markPlayerNotReady = useCallback(() => {
    setIsPlayerReady(false);
  }, []);

  // Store pending sync when player not ready
  const storePendingSync = useCallback((time: number, isPlaying: boolean) => {
    pendingSyncRef.current = {
      time,
      isPlaying,
      timestamp: Date.now()
    };
  }, []);

  // Upload file to Supabase Storage and return storage path
  const uploadMediaFile = useCallback(async (file: File): Promise<string | null> => {
    if (!user || !roomId) return null;

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${roomId}/${fileName}`;

      // Create DB record first
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

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('shared-media')
        .upload(filePath, file);

      if (uploadError) {
        await supabase
          .from('shared_files')
          .update({ upload_status: 'failed' })
          .eq('id', fileRecord.id);
        throw uploadError;
      }

      // Update status
      await supabase
        .from('shared_files')
        .update({ upload_status: 'completed' })
        .eq('id', fileRecord.id);

      // Return storage reference (not signed URL)
      return `storage:shared-media/${filePath}`;
    } catch (error) {
      console.error('[MediaSync] Upload failed:', error);
      return null;
    }
  }, [user, roomId]);

  // Generate signed URL from storage path
  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      // Extract bucket and path from storage:bucket/path format
      const match = storagePath.match(/^storage:([^/]+)\/(.+)$/);
      if (!match) return null;

      const [, bucket, path] = match;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600); // 1 hour

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('[MediaSync] Failed to get signed URL:', error);
      return null;
    }
  }, []);

  // Check if URL is a storage reference
  const isStorageUrl = useCallback((url: string): boolean => {
    return url.startsWith('storage:');
  }, []);

  // Sync media source to room
  const syncMediaSource = useCallback(async (url: string, type: string) => {
    try {
      await supabase
        .from('rooms')
        .update({ 
          current_media_url: url, 
          current_media_type: type 
        })
        .eq('id', roomId);
      console.log('[MediaSync] Media source synced:', { url, type });
    } catch (error) {
      console.error('[MediaSync] Failed to sync media source:', error);
    }
  }, [roomId]);

  // Send playback state update
  const sendPlaybackState = useCallback(async (time: number, isPlaying: boolean) => {
    if (!user) return;

    try {
      const { error, count } = await supabase
        .from('playback_state')
        .update({
          current_time_seconds: time,
          is_playing: isPlaying,
          last_updated_by: user.id,
          updated_at: new Date().toISOString()
        }, { count: 'exact' })
        .eq('room_id', roomId);

      if (error) throw error;

      // Insert if no row existed
      if (!count || count === 0) {
        await supabase.from('playback_state').insert({
          room_id: roomId,
          current_time_seconds: time,
          is_playing: isPlaying,
          last_updated_by: user.id
        });
      }
    } catch (error) {
      console.error('[MediaSync] Failed to send playback state:', error);
    }
  }, [roomId, user]);

  // Broadcast sync event for immediate partner notification
  const broadcastSync = useCallback(async (type: string, time: number, isPlaying: boolean) => {
    if (!channelRef.current || !user) return;

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'media_sync',
        payload: {
          type,
          time,
          isPlaying,
          userId: user.id,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('[MediaSync] Broadcast failed:', error);
    }
  }, [user]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`media_sync_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'playback_state',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const state = payload.new as any;
        
        // Skip own updates
        if (state.last_updated_by === user?.id) return;
        
        const time = Number(state.current_time_seconds) || 0;
        const isPlaying = !!state.is_playing;
        
        if (isPlayerReady) {
          onSyncReceived?.({
            time,
            isPlaying,
            mediaUrl: null,
            mediaType: null
          });
        } else {
          storePendingSync(time, isPlaying);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, async (payload) => {
        const room = payload.new as any;
        if (!room.current_media_url || !room.current_media_type) return;

        let mediaUrl = room.current_media_url;
        
        // Resolve storage URLs
        if (isStorageUrl(mediaUrl)) {
          const signedUrl = await getSignedUrl(mediaUrl);
          if (signedUrl) mediaUrl = signedUrl;
        }

        onSyncReceived?.({
          time: 0,
          isPlaying: false,
          mediaUrl,
          mediaType: room.current_media_type
        });
      })
      .on('broadcast', { event: 'media_sync' }, (payload) => {
        const data = payload.payload as any;
        if (data.userId === user?.id) return;
        
        const time = data.time || 0;
        const isPlaying = data.isPlaying ?? false;
        
        if (isPlayerReady) {
          onSyncReceived?.({
            time,
            isPlaying,
            mediaUrl: null,
            mediaType: null
          });
        } else {
          storePendingSync(time, isPlaying);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, isPlayerReady, onSyncReceived, storePendingSync, isStorageUrl, getSignedUrl]);

  // Fetch initial state
  const fetchInitialState = useCallback(async (): Promise<MediaSyncState | null> => {
    try {
      const [roomResult, playbackResult] = await Promise.all([
        supabase
          .from('rooms')
          .select('current_media_url, current_media_type')
          .eq('id', roomId)
          .single(),
        supabase
          .from('playback_state')
          .select('current_time_seconds, is_playing')
          .eq('room_id', roomId)
          .maybeSingle()
      ]);

      let mediaUrl = roomResult.data?.current_media_url || null;
      const mediaType = roomResult.data?.current_media_type || null;

      // Resolve storage URLs
      if (mediaUrl && isStorageUrl(mediaUrl)) {
        const signedUrl = await getSignedUrl(mediaUrl);
        if (signedUrl) mediaUrl = signedUrl;
      }

      return {
        time: Number(playbackResult.data?.current_time_seconds) || 0,
        isPlaying: !!playbackResult.data?.is_playing,
        mediaUrl,
        mediaType
      };
    } catch (error) {
      console.error('[MediaSync] Failed to fetch initial state:', error);
      return null;
    }
  }, [roomId, isStorageUrl, getSignedUrl]);

  return {
    isPlayerReady,
    markPlayerReady,
    markPlayerNotReady,
    uploadMediaFile,
    getSignedUrl,
    isStorageUrl,
    syncMediaSource,
    sendPlaybackState,
    broadcastSync,
    fetchInitialState
  };
};

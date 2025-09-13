import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

// Import WebTorrent dynamically to avoid SSR issues
let WebTorrent: any = null;

const initWebTorrent = async () => {
  if (typeof window !== 'undefined' && !WebTorrent) {
    const module = await import('webtorrent');
    WebTorrent = module.default;
  }
  return WebTorrent;
};

interface TorrentData {
  id: string;
  room_id: string;
  room_code: string;
  magnet: string;
  created_by: string;
  created_at: string;
}

export const useWebTorrent = (roomId?: string, roomCode?: string) => {
  const { user } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [seedingFiles, setSeedingFiles] = useState<Map<string, string>>(new Map());
  const [torrentData, setTorrentData] = useState<TorrentData | null>(null);

  // Initialize WebTorrent client
  useEffect(() => {
    const initClient = async () => {
      try {
        const WebTorrentClass = await initWebTorrent();
        if (WebTorrentClass) {
          const newClient = new WebTorrentClass();
          setClient(newClient);
          console.log('WebTorrent client initialized');
        }
      } catch (error) {
        console.error('Failed to initialize WebTorrent:', error);
      }
    };

    initClient();

    return () => {
      if (client) {
        client.destroy();
      }
    };
  }, []);

  // Listen for new torrent links in the room
  useEffect(() => {
    if (!roomCode || !user) return;

    const channel = supabase.channel(`torrent_links_${roomCode}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'torrent_links',
        filter: `room_code=eq.${roomCode}`
      }, (payload) => {
        console.log('New torrent link received:', payload);
        const newTorrent = payload.new as TorrentData;
        
        // Only auto-download if it's not from the current user
        if (newTorrent.created_by !== user.id) {
          setTorrentData(newTorrent);
          downloadFromMagnet(newTorrent.magnet);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, user]);

  const seedFile = useCallback(async (file: File): Promise<string | null> => {
    if (!client || !roomId || !roomCode || !user) {
      console.warn('WebTorrent client, room, or user not available');
      return null;
    }

    setIsSeeding(true);
    try {
      console.log('Starting to seed file:', file.name);
      
      return new Promise((resolve, reject) => {
        client.seed(file, (torrent: any) => {
          const magnetURI = torrent.magnetURI;
          console.log('File seeded successfully:', magnetURI);
          
          setSeedingFiles(prev => new Map(prev).set(file.name, magnetURI));
          
          // Store magnet link in Supabase
          supabase
            .from('torrent_links')
            .insert({
              room_id: roomId,
              room_code: roomCode,
              magnet: magnetURI,
              created_by: user.id
            })
            .then(({ error }) => {
              if (error) {
                console.error('Failed to store torrent link:', error);
              } else {
                console.log('Torrent link stored in database');
              }
            });

          toast({
            title: "File Shared! 🌐",
            description: `${file.name} is now being shared via P2P`,
          });

          resolve(magnetURI);
        });

        client.on('error', (error: any) => {
          console.error('WebTorrent seeding error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Failed to seed file:', error);
      toast({
        title: "Sharing Failed",
        description: "Failed to share file via P2P",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsSeeding(false);
    }
  }, [client, roomId, roomCode, user]);

  const downloadFromMagnet = useCallback(async (magnetURI: string): Promise<File | null> => {
    if (!client) {
      console.warn('WebTorrent client not available');
      return null;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      console.log('Starting download from magnet:', magnetURI);
      
      return new Promise((resolve, reject) => {
        client.add(magnetURI, (torrent: any) => {
          console.log('Torrent added, files:', torrent.files.length);
          
          torrent.on('download', () => {
            const progress = Math.round((torrent.downloaded / torrent.length) * 100);
            setDownloadProgress(progress);
          });

          torrent.on('done', () => {
            console.log('Download completed');
            const file = torrent.files[0];
            if (file) {
              toast({
                title: "Download Complete! 🎉",
                description: `${file.name} downloaded successfully via P2P`,
              });
              
              // Convert to File object
              file.getBlobURL((err: any, url: string) => {
                if (err) {
                  reject(err);
                  return;
                }
                
                fetch(url)
                  .then(response => response.blob())
                  .then(blob => {
                    const downloadedFile = new File([blob], file.name, { type: blob.type });
                    resolve(downloadedFile);
                  })
                  .catch(reject);
              });
            } else {
              reject(new Error('No files in torrent'));
            }
          });
        });

        client.on('error', (error: any) => {
          console.error('WebTorrent download error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Failed to download from magnet:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download file via P2P",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [client]);

  const stopSeeding = useCallback((fileName: string) => {
    if (!client) return;
    
    const magnetURI = seedingFiles.get(fileName);
    if (magnetURI) {
      const torrent = client.get(magnetURI);
      if (torrent) {
        torrent.destroy();
        console.log('Stopped seeding:', fileName);
      }
      
      setSeedingFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileName);
        return newMap;
      });
    }
  }, [client, seedingFiles]);

  const createVideoElement = useCallback((torrent: any): HTMLVideoElement | null => {
    if (!torrent || !torrent.files.length) return null;
    
    const videoFile = torrent.files.find((file: any) => 
      file.name.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i)
    );
    
    if (!videoFile) return null;
    
    const video = document.createElement('video');
    video.controls = true;
    video.className = 'w-full h-full object-contain';
    
    videoFile.renderTo(video, (err: any) => {
      if (err) {
        console.error('Error rendering video:', err);
      } else {
        console.log('Video rendered successfully');
      }
    });
    
    return video;
  }, []);

  return {
    client,
    isSeeding,
    isDownloading,
    downloadProgress,
    seedingFiles,
    torrentData,
    seedFile,
    downloadFromMagnet,
    stopSeeding,
    createVideoElement
  };
};
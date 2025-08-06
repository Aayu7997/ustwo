
import { useState, useCallback } from 'react';
import { webTorrentClient } from '@/utils/webTorrentClient';
import { toast } from '@/hooks/use-toast';

export const useWebTorrent = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [seedingFiles, setSeedingFiles] = useState<Map<string, string>>(new Map());

  const seedFile = useCallback(async (file: File): Promise<string | null> => {
    setIsSeeding(true);
    try {
      const magnetURI = await webTorrentClient.seedFile(file);
      if (magnetURI) {
        setSeedingFiles(prev => new Map(prev).set(file.name, magnetURI));
        toast({
          title: "P2P Sharing Active! 🌐",
          description: `${file.name} can now be streamed directly between partners`,
        });
      }
      return magnetURI;
    } catch (error) {
      console.error('Failed to seed file:', error);
      toast({
        title: "P2P Sharing Failed",
        description: "Could not enable peer-to-peer sharing for this file",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsSeeding(false);
    }
  }, []);

  const downloadFromMagnet = useCallback(async (magnetURI: string): Promise<File | null> => {
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const file = await webTorrentClient.downloadFromMagnet(
        magnetURI,
        (progress) => setDownloadProgress(progress)
      );
      
      if (file) {
        toast({
          title: "P2P Download Complete! 🎉",
          description: `File downloaded successfully via peer-to-peer connection`,
        });
      }
      
      return file;
    } catch (error) {
      console.error('Failed to download from magnet:', error);
      toast({
        title: "P2P Download Failed",
        description: "Could not download file via peer-to-peer connection",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, []);

  const stopSeeding = useCallback((fileName: string) => {
    setSeedingFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileName);
      return newMap;
    });
    webTorrentClient.destroy();
  }, []);

  return {
    isSeeding,
    isDownloading,
    downloadProgress,
    seedingFiles,
    seedFile,
    downloadFromMagnet,
    stopSeeding
  };
};

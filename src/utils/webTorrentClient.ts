
import { toast } from '@/hooks/use-toast';

// WebTorrent client utility for P2P file sharing
class WebTorrentClientWrapper {
  private client: any = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return this.client;

    try {
      // Dynamically import WebTorrent to avoid SSR issues
      const WebTorrent = (await import('webtorrent')).default;
      this.client = new WebTorrent();
      this.isInitialized = true;
      
      console.log('WebTorrent client initialized');
      return this.client;
    } catch (error) {
      console.error('Failed to initialize WebTorrent:', error);
      toast({
        title: "WebTorrent Error",
        description: "P2P file sharing is not available in this environment",
        variant: "destructive"
      });
      return null;
    }
  }

  async seedFile(file: File): Promise<string | null> {
    try {
      const client = await this.initialize();
      if (!client) return null;

      return new Promise((resolve, reject) => {
        client.seed(file, (torrent: any) => {
          console.log('File seeded successfully:', torrent.infoHash);
          toast({
            title: "File shared via P2P! 🚀",
            description: `${file.name} is now available for direct peer-to-peer streaming`
          });
          resolve(torrent.magnetURI);
        });

        setTimeout(() => {
          reject(new Error('Seeding timeout'));
        }, 30000); // 30 second timeout
      });
    } catch (error) {
      console.error('Failed to seed file:', error);
      toast({
        title: "P2P Sharing Error",
        description: "Could not share file via WebTorrent",
        variant: "destructive"
      });
      return null;
    }
  }

  async downloadFromMagnet(magnetURI: string, onProgress?: (progress: number) => void): Promise<File | null> {
    try {
      const client = await this.initialize();
      if (!client) return null;

      return new Promise((resolve, reject) => {
        const torrent = client.add(magnetURI, { announce: [] });

        torrent.on('ready', () => {
          console.log('Torrent ready:', torrent.name);
          const file = torrent.files[0];
          if (file) {
            resolve(file as File);
          } else {
            reject(new Error('No files in torrent'));
          }
        });

        torrent.on('download', () => {
          const progress = Math.round(torrent.progress * 100);
          onProgress?.(progress);
        });

        torrent.on('error', (error: Error) => {
          console.error('Torrent error:', error);
          reject(error);
        });

        setTimeout(() => {
          reject(new Error('Download timeout'));
        }, 60000); // 60 second timeout
      });
    } catch (error) {
      console.error('Failed to download from magnet:', error);
      toast({
        title: "P2P Download Error",
        description: "Could not download file via WebTorrent",
        variant: "destructive"
      });
      return null;
    }
  }

  destroy() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isInitialized = false;
      console.log('WebTorrent client destroyed');
    }
  }
}

export const webTorrentClient = new WebTorrentClientWrapper();

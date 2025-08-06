
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

export const useGoogleDrive = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);

  // Mock Google Drive functionality since provider may not be enabled
  const connectGoogleDrive = async () => {
    setLoading(true);
    try {
      // Try OAuth first, fallback to mock data
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/drive.readonly',
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        // Fallback: Show message about Google Drive integration
        toast({
          title: "Google Drive Integration",
          description: "Google Drive integration requires OAuth setup in Supabase. Using local files for now.",
          variant: "default"
        });
        setConnected(false);
      } else {
        setConnected(true);
        toast({
          title: "Connecting to Google Drive...",
          description: "Please grant access to your Google Drive files"
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection info",
        description: "Google Drive integration is not configured. Please use local file uploads.",
        variant: "default"
      });
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriveFiles = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration since Google Drive API may not be configured
      const mockFiles: GoogleDriveFile[] = [
        {
          id: 'mock1',
          name: 'Sample Video.mp4',
          mimeType: 'video/mp4',
          size: '52428800',
          webViewLink: 'https://drive.google.com/file/d/mock1/view',
          webContentLink: 'https://drive.google.com/uc?id=mock1'
        }
      ];
      
      setDriveFiles(mockFiles);
      toast({
        title: "Demo Mode",
        description: "Showing sample files. Configure Google Drive OAuth in Supabase for real integration.",
      });
    } catch (error) {
      console.error('Error fetching Google Drive files:', error);
      toast({
        title: "Info",
        description: "Google Drive API not configured. Please use local file upload instead.",
        variant: "default"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    connected,
    loading,
    driveFiles,
    connectGoogleDrive,
    fetchDriveFiles,
    checkGoogleDriveConnection: () => {}
  };
};

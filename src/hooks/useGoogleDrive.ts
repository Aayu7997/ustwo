
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

interface GoogleDriveToken {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

export const useGoogleDrive = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);

  // Check if user has Google Drive token
  useEffect(() => {
    checkGoogleDriveConnection();
  }, [user]);

  const checkGoogleDriveConnection = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('google_drive_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && new Date(data.expires_at) > new Date()) {
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch (error) {
      console.error('Error checking Google Drive connection:', error);
      setConnected(false);
    }
  };

  const connectGoogleDrive = async () => {
    setLoading(true);
    try {
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

      if (error) throw error;

      toast({
        title: "Connecting to Google Drive...",
        description: "Please grant access to your Google Drive files"
      });
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to Google Drive",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getGoogleDriveToken = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('google_drive_tokens')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return null;

      // Check if token is expired
      if (new Date(data.expires_at) <= new Date()) {
        // TODO: Implement token refresh
        return null;
      }

      return data.access_token;
    } catch (error) {
      console.error('Error getting Google Drive token:', error);
      return null;
    }
  };

  const fetchDriveFiles = async () => {
    const token = await getGoogleDriveToken();
    if (!token) return [];

    setLoading(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=mimeType contains 'video/' and trashed=false&fields=files(id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink)`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch Google Drive files');

      const data = await response.json();
      setDriveFiles(data.files || []);
      return data.files || [];
    } catch (error) {
      console.error('Error fetching Google Drive files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Google Drive files",
        variant: "destructive"
      });
      return [];
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
    checkGoogleDriveConnection
  };
};

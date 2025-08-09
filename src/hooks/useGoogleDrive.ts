
import { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
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
        const msg = (error as any)?.message?.toLowerCase?.() || '';
        const isProviderDisabled = msg.includes('unsupported provider') || msg.includes('provider is not enabled') || (error as any)?.code === 'validation_failed';
        toast({
          title: isProviderDisabled ? "Google provider disabled" : "Google Drive Integration",
          description: isProviderDisabled
            ? "Enable Google provider in Supabase (Auth > Providers) and add Drive scope, then try again."
            : "Google Drive integration requires OAuth setup in Supabase. Using local files for now.",
          variant: isProviderDisabled ? "destructive" : "default"
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
      // Try to get Google access token from the current session
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = (sessionData?.session as any)?.provider_token as string | undefined;

      if (!accessToken) {
        toast({
          title: "Google not linked",
          description: "Please sign in with Google to access Drive files.",
          variant: "destructive"
        });
        setDriveFiles([]);
        return;
      }

      const query = new URLSearchParams({
        q: "(mimeType contains 'video/' or mimeType contains 'audio/') and trashed = false",
        fields: "files(id,name,mimeType,size,thumbnailLink)",
        pageSize: "25",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Drive list failed (${res.status})`);
      }

      const json = await res.json();
      const files: GoogleDriveFile[] = (json.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        webViewLink: `https://drive.google.com/file/d/${f.id}/view`,
        // Stream via edge function with Range + CORS support
        webContentLink: `${SUPABASE_URL}/functions/v1/drive-proxy?fileId=${f.id}&token=${encodeURIComponent(accessToken)}`,
        thumbnailLink: f.thumbnailLink,
      }));

      setDriveFiles(files);
      toast({
        title: "Google Drive Connected",
        description: `Loaded ${files.length} media file(s) from Drive.`,
      });
    } catch (error: any) {
      console.error('Error fetching Google Drive files:', error);
      toast({
        title: "Google Drive Error",
        description: error.message || "Unable to load Drive files.",
        variant: "destructive"
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

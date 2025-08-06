
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useGoogleAuth = () => {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        // Fallback to regular email auth if Google is not configured
        toast({
          title: "Google Sign-in not available",
          description: "Please use email and password to sign in. Google authentication needs to be configured in Supabase.",
          variant: "destructive"
        });
        throw error;
      }
      
      toast({
        title: "Signing in with Google...",
        description: "Please complete the authentication in the popup window"
      });
      
      return { data, error: null };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast({
        title: "Sign-in failed",
        description: "Google authentication is not enabled. Please use email/password or contact support.",
        variant: "destructive"
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  return {
    signInWithGoogle,
    loading
  };
};

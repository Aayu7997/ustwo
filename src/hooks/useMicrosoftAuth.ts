import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useMicrosoftAuth = () => {
  const [loading, setLoading] = useState(false);

  const signInWithMicrosoft = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/`,
          scopes: 'email profile openid User.Read Calendars.Read',
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        toast({
          title: "Microsoft Sign-in not available",
          description: "Please use email and password to sign in. Microsoft authentication needs to be configured in Supabase.",
          variant: "destructive"
        });
        throw error;
      }
      
      toast({
        title: "Signing in with Microsoft...",
        description: "Please complete the authentication in the popup window"
      });
      
      return { data, error: null };
    } catch (error: any) {
      console.error('Microsoft sign-in error:', error);
      toast({
        title: "Sign-in failed",
        description: "Microsoft authentication is not enabled. Please use email/password.",
        variant: "destructive"
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  return {
    signInWithMicrosoft,
    loading
  };
};

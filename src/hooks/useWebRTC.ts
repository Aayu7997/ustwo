
import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface WebRTCProps {
  roomId: string;
  roomCode?: string;
  enabled: boolean;
}

export const useWebRTC = ({ roomId, roomCode, enabled }: WebRTCProps) => {
  const { user } = useAuth();
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const channelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const initializeMedia = useCallback(async () => {
    try {
      console.log('Requesting media permissions...');
      
      // First check if getUserMedia is available
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported on this browser');
      }
      
      // Try to get media with fallback constraints
      let mediaStream: MediaStream;
      
      try {
        // Try with high quality first
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
            frameRate: { ideal: 30, min: 15 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: { ideal: 44100, min: 16000 }
          }
        });
      } catch (highQualityError) {
        console.log('High quality failed, trying basic constraints:', highQualityError);
        
        // Fallback to basic constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      }
      
      console.log('Media stream obtained successfully:', {
        videoTracks: mediaStream.getVideoTracks().length,
        audioTracks: mediaStream.getAudioTracks().length,
        id: mediaStream.id
      });
      
      setStream(mediaStream);
      
      // Set up local video with better error handling
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.autoplay = true;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const video = localVideoRef.current;
          if (!video) {
            reject(new Error('Video element not found'));
            return;
          }
          
          const onLoad = () => {
            video.removeEventListener('loadedmetadata', onLoad);
            video.removeEventListener('error', onError);
            resolve(true);
          };
          
          const onError = (e: any) => {
            video.removeEventListener('loadedmetadata', onLoad);
            video.removeEventListener('error', onError);
            console.error('Video element error:', e);
            reject(e);
          };
          
          video.addEventListener('loadedmetadata', onLoad);
          video.addEventListener('error', onError);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoad);
            video.removeEventListener('error', onError);
            resolve(true); // Continue even if video doesn't load
          }, 5000);
        });
      }
      
      toast({
        title: "Camera & Microphone Ready! 📹",
        description: "You can now start your video call"
      });
      
      return mediaStream;
    } catch (error) {
      console.error('Media initialization failed:', error);
      let errorMessage = "Failed to access camera/microphone";
      let userActions = "";
      
      if (error instanceof Error) {
        console.log('Error details:', { name: error.name, message: error.message });
        
        if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
          errorMessage = "Camera/microphone access denied";
          userActions = "Please click 'Allow' when prompted for camera and microphone permissions.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No camera/microphone found";
          userActions = "Please connect a camera/microphone and try again.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "Camera/microphone is already in use";
          userActions = "Please close other applications using your camera/microphone.";
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = "Camera/microphone constraints not supported";
          userActions = "Your device doesn't support the required video/audio quality.";
        } else if (error.message.includes('getUserMedia not supported')) {
          errorMessage = "Video calls not supported on this browser";
          userActions = "Please try using Chrome, Firefox, or Safari.";
        }
      }
      
      toast({
        title: "Media Access Issue 📱",
        description: `${errorMessage}. ${userActions}`,
        variant: "destructive"
      });
      throw error;
    }
  }, []);

  const createPeer = useCallback((initiator: boolean, stream: MediaStream) => {
    console.log('Creating peer, initiator:', initiator);
    
    const newPeer = new SimplePeer({
      initiator,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10
      }
    });

    newPeer.on('signal', async (data) => {
      console.log('Sending signal:', data.type, 'from user:', user?.id);
      
      // Store signal in rtc_signaling table
      const { error } = await supabase
        .from('rtc_signaling')
        .insert({
          room_id: roomId,
          room_code: roomCode || '',
          type: data.type || 'candidate',
          payload: data,
          sender: user?.id
        });
      
      if (error) {
        console.error('Failed to store RTC signal:', error);
      }
    });

    newPeer.on('stream', (remoteStream) => {
      console.log('Received remote stream with', remoteStream.getTracks().length, 'tracks');
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    newPeer.on('connect', () => {
      console.log('Peer connection established successfully');
      setIsConnected(true);
      toast({
        title: "Video Call Connected! 💕",
        description: "You're now connected for video chat!"
      });
    });

    newPeer.on('close', () => {
      console.log('Peer connection closed');
      setIsConnected(false);
      setRemoteStream(null);
    });

    newPeer.on('error', (error) => {
      console.error('WebRTC peer error:', error);
      toast({
        title: "Connection Issue",
        description: "There was a problem with the video connection. Please try again.",
        variant: "destructive"
      });
    });

    return newPeer;
  }, [user?.id]);

  const startCall = useCallback(async () => {
    if (!enabled || !user) return;

    try {
      console.log('Starting call for user:', user.id);
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(true, mediaStream);
      setPeer(newPeer);
      setIsInitiator(true);
      
      toast({
        title: "Starting video call...",
        description: "Waiting for your partner to join"
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      throw error; // Propagate so caller can handle UI state
    }
  }, [enabled, user, initializeMedia, createPeer]);

  const answerCall = useCallback(async (signal: any) => {
    if (!enabled || !user) return;

    try {
      console.log('Answering call from signal:', signal.type);
      const mediaStream = await initializeMedia();
      const newPeer = createPeer(false, mediaStream);
      setPeer(newPeer);
      setIsInitiator(false);
      
      // Answer the call
      newPeer.signal(signal);
      
      toast({
        title: "Joining video call...",
        description: "Connecting to your partner"
      });
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }, [enabled, user, initializeMedia, createPeer]);

  const endCall = useCallback(() => {
    console.log('Ending call');
    
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setStream(null);
    }
    
    setRemoteStream(null);
    setIsConnected(false);
    setIsInitiator(false);
    
    toast({
      title: "Call ended",
      description: "Video call has been disconnected"
    });
  }, [peer, stream]);

  useEffect(() => {
    if (!roomId || !enabled || !user) return;

    console.log('Setting up WebRTC signaling for room:', roomId);

    // Subscribe to rtc_signaling table changes
    const channel = supabase.channel(`rtc_signaling_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_signaling',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const signalData = payload.new;

        // Ignore our own signals
        if (signalData.sender === user.id) {
          console.log('Ignoring own signal');
          return;
        }

        console.log('Received signal:', signalData.type, 'from:', signalData.sender);
        const signal = signalData.payload;

        if (signal.type === 'offer' && !peer) {
          console.log('Receiving call offer');
          answerCall(signal);
        } else if (peer && signal.type === 'answer') {
          console.log('Receiving call answer');
          peer.signal(signal);
        } else if (peer && (signal.candidate || signalData.type === 'candidate')) {
          console.log('Receiving ICE candidate');
          peer.signal(signal);
        }
      })
      .subscribe((status) => {
        console.log('RTC signaling channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('Cleaning up RTC signaling channel');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, enabled, user, answerCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    localVideoRef,
    remoteVideoRef,
    isConnected,
    stream,
    remoteStream,
    isInitiator,
    startCall,
    endCall,
    peer
  };
};

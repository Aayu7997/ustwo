import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Subtitle {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface UseSubtitleSyncProps {
  roomId: string;
  currentTime: number;
}

export const useSubtitleSync = ({ roomId, currentTime }: UseSubtitleSyncProps) => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [subtitleUrl, setSubtitleUrl] = useState<string>('');
  const channelRef = useRef<any>(null);

  // Parse SRT format
  const parseSRT = (srtText: string): Subtitle[] => {
    const blocks = srtText.trim().split(/\n\n+/);
    return blocks.map((block) => {
      const lines = block.split('\n');
      if (lines.length < 3) return null;

      const index = parseInt(lines[0]);
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      
      if (!timeMatch) return null;

      const startTime = 
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;

      const endTime = 
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      const text = lines.slice(2).join('\n');

      return { index, startTime, endTime, text };
    }).filter((sub): sub is Subtitle => sub !== null);
  };

  // Parse VTT format
  const parseVTT = (vttText: string): Subtitle[] => {
    const lines = vttText.split('\n');
    const subtitles: Subtitle[] = [];
    let currentIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
      
      if (timeMatch) {
        const startTime = 
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 1000;

        const endTime = 
          parseInt(timeMatch[5]) * 3600 +
          parseInt(timeMatch[6]) * 60 +
          parseInt(timeMatch[7]) +
          parseInt(timeMatch[8]) / 1000;

        // Get text lines until next blank line or timestamp
        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() && !lines[i].includes('-->')) {
          textLines.push(lines[i].trim());
          i++;
        }

        subtitles.push({
          index: currentIndex++,
          startTime,
          endTime,
          text: textLines.join('\n')
        });
      }
    }

    return subtitles;
  };

  // Load subtitle file
  const loadSubtitles = async (url: string, format: 'srt' | 'vtt') => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      const parsed = format === 'srt' ? parseSRT(text) : parseVTT(text);
      setSubtitles(parsed);
      setSubtitleUrl(url);
    } catch (error) {
      console.error('Error loading subtitles:', error);
      setSubtitles([]);
    }
  };

  // Find current subtitle based on time
  useEffect(() => {
    if (subtitles.length === 0) {
      setCurrentSubtitle('');
      return;
    }

    const current = subtitles.find(
      sub => currentTime >= sub.startTime && currentTime <= sub.endTime
    );

    setCurrentSubtitle(current?.text || '');
  }, [currentTime, subtitles]);

  // Listen for subtitle uploads from partner
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_${roomId}`);
    
    channel.on('broadcast', { event: 'subtitle_uploaded' }, (payload: any) => {
      const { url, format } = payload.payload;
      loadSubtitles(url, format);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId]);

  return {
    currentSubtitle,
    loadSubtitles,
    clearSubtitles: () => {
      setSubtitles([]);
      setCurrentSubtitle('');
      setSubtitleUrl('');
    },
    hasSubtitles: subtitles.length > 0
  };
};

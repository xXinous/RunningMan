import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { VideoIntel } from '../../services/IntelEngine';
import { loadYoutubeIframeApi } from '../../lib/youtube';

export interface NokiaVideoSurfaceHandle {
  getCurrentTime: () => number;
  getDuration: () => number;
  rewind: () => void;
}

interface NokiaVideoSurfaceProps {
  intel: VideoIntel;
  isPlaying: boolean;
  volume: number;
  onEnded?: () => void;
}

const NokiaVideoSurface = forwardRef<NokiaVideoSurfaceHandle, NokiaVideoSurfaceProps>(
  function NokiaVideoSurface({ intel, isPlaying, volume, onEnded }, ref) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const ytContainerRef = useRef<HTMLDivElement | null>(null);
    const ytPlayerRef = useRef<any>(null);
    const isYoutube = intel.isYoutube();

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        if (isYoutube && ytPlayerRef.current?.getCurrentTime) {
          return ytPlayerRef.current.getCurrentTime() || 0;
        }
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        if (isYoutube && ytPlayerRef.current?.getDuration) {
          return ytPlayerRef.current.getDuration() || 0;
        }
        return videoRef.current?.duration || 0;
      },
      rewind: () => {
        if (isYoutube && ytPlayerRef.current?.seekTo) {
          ytPlayerRef.current.seekTo(0, true);
        } else if (videoRef.current) {
          videoRef.current.currentTime = 0;
        }
      },
    }));

    // YouTube player lifecycle
    useEffect(() => {
      if (!isYoutube || !intel.youtubeId) return;

      let cancelled = false;

      const initPlayer = async () => {
        await loadYoutubeIframeApi();
        if (cancelled || !ytContainerRef.current) return;

        try {
          ytPlayerRef.current?.destroy?.();
        } catch {
          /* ignore */
        }

        ytPlayerRef.current = new (window as any).YT.Player(ytContainerRef.current, {
          videoId: intel.youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onStateChange: (e: any) => {
              const YT = (window as any).YT;
              if (e.data === YT.PlayerState.ENDED) {
                onEnded?.();
              }
            },
          },
        });
      };

      initPlayer();

      return () => {
        cancelled = true;
        try {
          ytPlayerRef.current?.destroy?.();
        } catch {
          /* ignore */
        }
        ytPlayerRef.current = null;
      };
    }, [isYoutube, intel.youtubeId, onEnded]);

    // Sync play/pause
    useEffect(() => {
      if (isYoutube) {
        const player = ytPlayerRef.current;
        if (!player?.playVideo) return;
        if (isPlaying) player.playVideo();
        else player.pauseVideo();
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      if (isPlaying) video.play().catch(() => {});
      else video.pause();
    }, [isPlaying, isYoutube, intel.id]);

    // Sync volume
    useEffect(() => {
      if (isYoutube) {
        ytPlayerRef.current?.setVolume?.(volume);
        return;
      }
      if (videoRef.current) videoRef.current.volume = volume / 100;
    }, [volume, isYoutube, intel.id]);

    useEffect(() => {
      if (isYoutube) return;
      const video = videoRef.current;
      if (!video) return;
      const handleEnded = () => onEnded?.();
      video.addEventListener('ended', handleEnded);
      return () => video.removeEventListener('ended', handleEnded);
    }, [isYoutube, intel.id, onEnded]);

    return (
      <div className="relative w-full h-full bg-black">
        {isYoutube ? (
          <div ref={ytContainerRef} className="w-full h-full pointer-events-none" />
        ) : (
          <video
            ref={videoRef}
            src={intel.mediaUrl}
            className="w-full h-full object-contain"
            playsInline
            preload="metadata"
          />
        )}
        <div className="absolute top-1 left-1 bg-[#edfeed] text-[#111e14] text-[8px] font-black px-1 border border-[#111e14] uppercase">
          {isYoutube ? 'YT' : intel.format}
        </div>
      </div>
    );
  }
);

export default NokiaVideoSurface;

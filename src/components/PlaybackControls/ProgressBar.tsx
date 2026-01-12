/**
 * ProgressBar - Playback progress indicator
 */

import React from 'react';

interface ProgressBarProps {
  progress: number;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
}

export function ProgressBar({
  progress,
  currentTime,
  totalDuration,
  onSeek,
}: ProgressBarProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * totalDuration;
    onSeek(Math.max(0, Math.min(seekTime, totalDuration)));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div
        className="relative h-4 flex items-center cursor-pointer group"
        onClick={handleClick}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gray-200 rounded-full overflow-hidden">
          {/* Progress */}
          <div
            className="h-full bg-blue-600 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className="absolute h-4 w-4 bg-white border-2 border-blue-600 rounded-full shadow-md transform -translate-x-1/2 transition-transform group-hover:scale-110"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-sm text-gray-500 mt-1">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(totalDuration)}</span>
      </div>
    </div>
  );
}

export default ProgressBar;

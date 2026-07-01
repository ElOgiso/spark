/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { PublishJob, ReviewItem } from '../types';
import { Calendar as CalendarIcon, List, Clock, CheckCircle2, AlertCircle, PlayCircle, Share2, Eye, MessageSquare, Heart } from 'lucide-react';

interface CalendarViewProps {
  publishJobs: PublishJob[];
  reviewItems: ReviewItem[];
  onPublishNow: (id: string) => void;
}

export default function CalendarView({
  publishJobs,
  reviewItems,
  onPublishNow
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [currentMonth, setCurrentMonth] = useState('July 2026');

  // Days of July 2026 starting from Wednesday (July 1st)
  const daysInJuly = Array.from({ length: 31 }, (_, i) => i + 1);

  // Group publish jobs by day of month (based on dates like '2026-07-02T15:00:00Z')
  const getJobsForDay = (day: number) => {
    return publishJobs.filter((job) => {
      const date = new Date(job.publishTime);
      return date.getMonth() === 6 && date.getDate() === day; // 6 is July (0-indexed)
    });
  };

  const getReviewItemDetails = (job: PublishJob) => {
    return reviewItems.find((item) => item.id === job.reviewItemId);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 pb-24" id="spark-calendar-tab">
      {/* Tab Header with view switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-display sm:text-3xl">
            PUBLISH CALENDAR
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Timetable of scheduled distributions and active platform publish states.
          </p>
        </div>

        {/* View Mode selector */}
        <div className="flex rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${
              viewMode === 'timeline'
                ? 'bg-zinc-850 text-amber-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            TIMELINE
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all ${
              viewMode === 'grid'
                ? 'bg-zinc-850 text-amber-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            GRID
          </button>
        </div>
      </div>

      {/* Main View Container */}
      <div className="rounded-2xl border border-zinc-850 bg-zinc-900/40 p-5 backdrop-blur-sm">
        {viewMode === 'timeline' ? (
          /* Timeline view list */
          <div className="flex flex-col gap-5">
            <h2 className="text-xs font-bold tracking-wider text-zinc-500 font-mono">PUBLISHING TIMELINE</h2>
            {publishJobs.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500 font-mono">
                No active scheduled posts. Drafts must be approved from the Review queue.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {publishJobs.map((job) => {
                  const details = getReviewItemDetails(job);
                  const isScheduled = job.status === 'scheduled';
                  const isPublished = job.status === 'published';
                  const isPublishing = job.status === 'publishing';
                  
                  return (
                    <div
                      key={job.id}
                      className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Status Icon Indicator */}
                        <div className="mt-1.5 shrink-0">
                          {isPublished ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : isPublishing ? (
                            <PlayCircle className="h-5 w-5 text-amber-500 animate-spin" />
                          ) : (
                            <Clock className="h-5 w-5 text-zinc-500" />
                          )}
                        </div>

                        {/* Text summary */}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-zinc-200">
                              {details?.title || 'Production Post'}
                            </span>
                            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[9px] font-bold text-zinc-400 font-mono uppercase">
                              {job.platform.replace('_', ' ')}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold font-mono ${
                              isPublished ? 'bg-emerald-500/10 text-emerald-500' :
                              isPublishing ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800/80 text-zinc-400'
                            }`}>
                              {job.status.toUpperCase()}
                            </span>
                          </div>

                          <p className="mt-1.5 text-xs text-zinc-400 line-clamp-1 max-w-xl">
                            "{details?.hook || details?.description}"
                          </p>

                          <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-zinc-500 font-mono">
                            <span>RELEASE: {new Date(job.publishTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right-aligned Stats or Action */}
                      <div className="shrink-0 pt-2 border-t border-zinc-900 sm:pt-0 sm:border-0">
                        {isPublished && job.engagementStats ? (
                          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 font-mono">
                            <div className="flex items-center gap-1.5" title="Views">
                              <Eye className="h-4 w-4 text-zinc-500" />
                              <span>{job.engagementStats.views.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Likes">
                              <Heart className="h-4 w-4 text-zinc-500" />
                              <span>{job.engagementStats.likes.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5" title="Shares">
                              <Share2 className="h-4 w-4 text-zinc-500" />
                              <span>{job.engagementStats.shares.toLocaleString()}</span>
                            </div>
                          </div>
                        ) : isScheduled ? (
                          <button
                            onClick={() => onPublishNow(job.id)}
                            className="w-full rounded-lg bg-zinc-100 px-3.5 py-1.5 text-[10px] font-bold tracking-wider text-zinc-950 hover:bg-zinc-200 transition-colors sm:w-auto"
                          >
                            PUBLISH INSTANTLY
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-600 font-mono">
                            DISPATCH QUEUED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Calendar Month grid (Desktop) */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold tracking-wider text-zinc-300 font-display">{currentMonth}</h2>
              <span className="text-xs text-zinc-500 font-mono">Wednesday Base-start</span>
            </div>

            {/* Grid days layout */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold tracking-wider text-zinc-500 font-mono uppercase mb-1">
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {daysInJuly.map((day) => {
                const dayJobs = getJobsForDay(day);
                const hasJobs = dayJobs.length > 0;
                return (
                  <div
                    key={day}
                    className={`min-h-[72px] rounded-xl border p-2 text-left flex flex-col justify-between transition-colors ${
                      hasJobs
                        ? 'border-amber-500/30 bg-amber-500/[0.01]'
                        : 'border-zinc-850 bg-zinc-950/20 hover:border-zinc-800'
                    }`}
                  >
                    <span className={`text-[10px] font-bold font-mono ${hasJobs ? 'text-amber-500' : 'text-zinc-600'}`}>
                      {day}
                    </span>
                    
                    {hasJobs && (
                      <div className="flex flex-col gap-1 mt-1">
                        {dayJobs.map((job) => (
                          <div
                            key={job.id}
                            className={`rounded px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide uppercase truncate font-mono ${
                              job.status === 'published' ? 'bg-emerald-500/10 text-emerald-500' :
                              job.status === 'publishing' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-400'
                            }`}
                            title={`${getReviewItemDetails(job)?.title || 'Post'} on ${job.platform}`}
                          >
                            {job.platform.replace('_reels', '').replace('_shorts', '').replace('tiktok', 'TT')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

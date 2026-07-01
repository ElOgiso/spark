/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Tab = 'spark' | 'my-spark' | 'viral-sparks' | 'review' | 'calendar' | 'analytics' | 'more';
export type ProductionMode = 'Auto-Pilot' | 'Co-Pilot' | 'Draft Only';
export type AutomationMode = 'Full' | 'Approve Actions' | 'Manual';

export interface Brand {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  niche: Niche;
  character: Character;
  productionMode: ProductionMode;
  automationMode: AutomationMode;
}

export interface Character {
  name: string;
  role: string;
  toneOfVoice: string[];
  visualStyle: string;
  targetAudience: string;
}

export interface Niche {
  topic: string;
  industry: string;
  pillars: string[];
  keywords: string[];
}

export interface Audio {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  url: string;
  trendingRank?: number;
}

export interface Account {
  id: string;
  platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels';
  username: string;
  connected: boolean;
  followersCount: number;
}

export interface Spark {
  id: string;
  title: string;
  hook: string;
  viralScore: number; // 0-100
  sourceTrend: string;
  discoveredAt: Date | string;
  status: 'new' | 'producing' | 'archived';
  suggestedAudioId?: string;
}

export interface QualityCheck {
  id: string;
  label: string;
  passed: boolean;
  details?: string;
}

export interface ExportPackage {
  mp4Url: string;
  srtUrl?: string;
  metadata: {
    title: string;
    description: string;
    tags: string[];
  };
}

export interface ReviewItem {
  id: string;
  sparkId: string;
  title: string;
  hook: string;
  description: string;
  tags: string[];
  videoPreviewUrl: string; // fallback placeholder video
  audioId: string;
  qualityChecks: QualityCheck[];
  exportPackage: ExportPackage;
  status: 'pending' | 'approved' | 'rejected';
  scheduledPublishTime?: Date | string;
}

export interface Production {
  id: string;
  sparkId: string;
  title: string;
  step: 'research' | 'scripting' | 'storyboarding' | 'voiceover' | 'visual_assembly' | 'rendered' | 'failed';
  progress: number; // 0-100
  startedAt: Date | string;
  estimatedCompletion: Date | string;
}

export interface PublishJob {
  id: string;
  reviewItemId: string;
  platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels';
  status: 'scheduled' | 'publishing' | 'published' | 'failed';
  publishTime: Date | string;
  engagementStats?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface Insight {
  id: string;
  category: 'hook' | 'pacing' | 'audio' | 'niche';
  headline: string;
  metricChange: string; // e.g., "+40% Retention"
  description: string;
  timestamp: Date | string;
}

export interface Memory {
  id: string;
  topic: string;
  learnedFact: string;
  provenHypothesis: boolean;
  updatedAt: Date | string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'video_clip' | 'logo' | 'font' | 'template';
  url: string;
  size: string;
}

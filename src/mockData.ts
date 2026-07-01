/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Brand, Spark, Production, ReviewItem, PublishJob, Insight, Memory, Asset, Account, Audio } from './types';

export const mockBrands: Brand[] = [
  {
    id: 'brand-1',
    name: 'The AI Alchemist',
    handle: '@aialchemist',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    niche: {
      topic: 'AI Automation & Productivity Hacks',
      industry: 'Artificial Intelligence & Technology',
      pillars: ['ChatGPT secret workflows', 'AI business model builders', 'No-code integration tutorials'],
      keywords: ['AI Alchemist', 'automation tips', 'nocode tools', 'future of work', 'chatgpt pro']
    },
    character: {
      name: 'Elara',
      role: 'Futuristic technical strategist who is articulate, deeply logical, yet approachable and punchy.',
      toneOfVoice: ['Authoritative but witty', 'Paced and precise', 'Extremely high signal-to-noise ratio', 'Zero fluff'],
      visualStyle: 'Sleek glassmorphism overlays, cyberpunk secondary accents (glowing cyan and violet), crisp monospace captions.',
      targetAudience: 'Solo founders, tech-curious professionals, and system-builders seeking leverage.'
    },
    productionMode: 'Co-Pilot',
    automationMode: 'Approve Actions'
  },
  {
    id: 'brand-2',
    name: 'SaaS Hustle',
    handle: '@saashustle',
    avatarUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=150&auto=format&fit=crop&q=80',
    niche: {
      topic: 'B2B Software Bootstrapping',
      industry: 'Startup & Entrepreneurship',
      pillars: ['Zero-funding growth', 'Cold email templates', 'Micro-SaaS ideas to build'],
      keywords: ['indie hacker', 'bootstrapping', 'micro saas', 'marketing tips', 'solopreneur']
    },
    character: {
      name: 'Marcus',
      role: 'Energetic startup mentor who has failed 5 times and succeeded on the 6th. Raw, direct, and pragmatic.',
      toneOfVoice: ['Gritty & honest', 'High-energy pacing', 'Action-oriented checklists', 'Relatable builder anecdotes'],
      visualStyle: 'High-contrast yellow accents, fast jump-cuts, kinetic bold text popups, raw screen recordings with camera bubble.',
      targetAudience: 'Aspiring builders, side hustlers, and software engineers tired of corporate jobs.'
    },
    productionMode: 'Auto-Pilot',
    automationMode: 'Full'
  },
  {
    id: 'brand-3',
    name: 'Mindful Moments',
    handle: '@mindful_moments',
    avatarUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=150&auto=format&fit=crop&q=80',
    niche: {
      topic: 'Micro Meditation & Breathing Breaks',
      industry: 'Wellness & Mindfulness',
      pillars: ['60-second decompression', 'Interactive box breathing', 'Somatic grounding sounds'],
      keywords: ['breathwork', 'anxiety relief', 'quick peace', '60s meditation', 'mental health']
    },
    character: {
      name: 'Aria',
      role: 'Serene vocal guide and somatic practitioner. Soft, warm, and highly stabilizing presence.',
      toneOfVoice: ['Slow, rhythmic cadence', 'Breath-paired phrasing', 'Validating & calm', 'Minimal speaking, maximum atmosphere'],
      visualStyle: 'Slow drifting abstract canvas backgrounds, soft pastel golden and earthy gradients, breathing circle expansions.',
      targetAudience: 'Stressed office workers, overthinkers, and anyone needing a nervous system reset.'
    },
    productionMode: 'Draft Only',
    automationMode: 'Manual'
  }
];

export const mockAccounts: Record<string, Account[]> = {
  'brand-1': [
    { id: 'acc-1', platform: 'tiktok', username: '@aialchemist.hq', connected: true, followersCount: 14200 },
    { id: 'acc-2', platform: 'youtube_shorts', username: 'AI Alchemist Shorts', connected: true, followersCount: 8900 },
    { id: 'acc-3', platform: 'instagram_reels', username: '@ai.alchemist', connected: false, followersCount: 0 }
  ],
  'brand-2': [
    { id: 'acc-4', platform: 'tiktok', username: '@saashustle.dev', connected: true, followersCount: 38200 },
    { id: 'acc-5', platform: 'instagram_reels', username: '@saashustle_global', connected: true, followersCount: 51000 }
  ],
  'brand-3': [
    { id: 'acc-6', platform: 'tiktok', username: '@mindfulmoments_app', connected: true, followersCount: 950 }
  ]
};

export const mockSparks: Record<string, Spark[]> = {
  'brand-1': [
    {
      id: 'spark-1-1',
      title: 'ChatGPT o3 Reasoning Engine for Devs',
      hook: 'ChatGPT o3 is out, but 99% of programmers are using it completely wrong. Here is the secret chain-of-thought bypass.',
      viralScore: 94,
      sourceTrend: 'OpenAI o3 release & Developer Twitter discourse',
      discoveredAt: '2026-07-01T04:15:00Z',
      status: 'new',
      suggestedAudioId: 'aud-1'
    },
    {
      id: 'spark-1-2',
      title: 'Make $500/day setting up Make.com workflows for local dental offices',
      hook: 'Local clinics are losing up to $10,000 a month in missed appointments. Here is how you can fix it in 20 minutes with zero code.',
      viralScore: 89,
      sourceTrend: 'No-Code Agency side hustle trends & local SEO updates',
      discoveredAt: '2026-06-30T18:30:00Z',
      status: 'producing',
      suggestedAudioId: 'aud-2'
    },
    {
      id: 'spark-1-3',
      title: 'The AI Notebook that replaces 5 analysts',
      hook: 'I just fed a raw CSV of sales logs into this free AI tool, and it spotted a pricing bug that saved us $4,200.',
      viralScore: 85,
      sourceTrend: 'NotebookLM & structured data analytics growth',
      discoveredAt: '2026-06-30T10:00:00Z',
      status: 'new'
    }
  ],
  'brand-2': [
    {
      id: 'spark-2-1',
      title: 'The 1-Page marketing playbook that got us our first 100 SaaS users',
      hook: 'No cold calling. No Google ads. Just this simple Notion directory trick.',
      viralScore: 91,
      sourceTrend: 'Indie Hacker bootstrapping threads',
      discoveredAt: '2026-07-01T02:00:00Z',
      status: 'new'
    },
    {
      id: 'spark-2-2',
      title: '3 Micro-SaaS niches ready to be dominated in Q3',
      hook: 'If I had to launch a new SaaS today with only $100 budget, I would build one of these three apps.',
      viralScore: 88,
      sourceTrend: 'Acquire.com micro-acquisition spikes',
      discoveredAt: '2026-06-30T22:10:00Z',
      status: 'new'
    }
  ],
  'brand-3': [
    {
      id: 'spark-3-1',
      title: 'Box breathing for high-stress developers',
      hook: 'Your neck is stiff. Your shoulders are tight. Stop scrolling and breathe with this expanding circle for 30 seconds.',
      viralScore: 97,
      sourceTrend: 'Developer burnout conversations & mental health hashtags',
      discoveredAt: '2026-07-01T05:00:00Z',
      status: 'new'
    }
  ]
};

export const mockProductions: Record<string, Production[]> = {
  'brand-1': [
    {
      id: 'prod-1-1',
      sparkId: 'spark-1-2',
      title: 'Make.com Local Dental Clinic Automations',
      step: 'voiceover',
      progress: 58,
      startedAt: '2026-07-01T03:00:00Z',
      estimatedCompletion: '2026-07-01T06:15:00Z'
    }
  ],
  'brand-2': [],
  'brand-3': []
};

export const mockReviewItems: Record<string, ReviewItem[]> = {
  'brand-1': [
    {
      id: 'rev-1-1',
      sparkId: 'spark-1-1',
      title: 'Reasoning Engine Secret Workflows',
      hook: 'ChatGPT o3 is out, but 99% of programmers are using it completely wrong.',
      description: 'Unlock the real power of OpenAI\'s reasoning model with this advanced Prompt Bypassing technique. Perfect for dev productivity. #chatgpt #coding #aitools #devproductivity #automation',
      tags: ['chatgpt', 'coding', 'aitools', 'devproductivity', 'automation'],
      videoPreviewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-matrix-style-computer-code-running-9114-large.mp4',
      audioId: 'aud-1',
      qualityChecks: [
        { id: 'qc-1', label: 'Audio Normalization (Target -14 LUFS)', passed: true },
        { id: 'qc-2', label: 'Monospace Visual Text Overlay Alignment', passed: true },
        { id: 'qc-3', label: 'High-Retention Hook Pacing (0.8s cuts)', passed: true },
        { id: 'qc-4', label: 'Aspect Ratio Verification (9:16 Portrait)', passed: true },
        { id: 'qc-5', label: 'CC/Subtitles Exact Phrase Match Check', passed: false, details: 'Reviewer manual confirmation suggested for words like "bypass".' }
      ],
      exportPackage: {
        mp4Url: '#',
        srtUrl: '#',
        metadata: {
          title: 'How 99% of Programmers Fail with o3',
          description: 'The secret is directing the model\'s internal scratchpad. Use this guide to double your output.',
          tags: ['openai', 'developer', 'softwareengineering', 'productivity']
        }
      },
      status: 'pending'
    }
  ],
  'brand-2': [
    {
      id: 'rev-2-1',
      sparkId: 'spark-2-2',
      title: 'Q3 SaaS Blueprint',
      hook: 'If I had to launch a new SaaS today with only $100 budget, I would build this...',
      description: 'Stop trying to build the next Facebook. Build these 3 micro utilities that businesses gladly pay $19/mo for. #indiehackers #saas #microsaas #sidehustle',
      tags: ['indiehackers', 'saas', 'microsaas', 'sidehustle'],
      videoPreviewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smartphone-over-a-keyboard-41315-large.mp4',
      audioId: 'aud-2',
      qualityChecks: [
        { id: 'qc-6', label: 'Audio Normalization (Target -14 LUFS)', passed: true },
        { id: 'qc-7', label: 'Bold Accent Text Overlays', passed: true },
        { id: 'qc-8', label: 'Aspect Ratio Verification (9:16 Portrait)', passed: true }
      ],
      exportPackage: {
        mp4Url: '#',
        metadata: {
          title: '3 Micro-SaaS Niches to Build in Q3',
          description: 'Forget VC funding. Build tools with concrete utility.',
          tags: ['entrepreneurship', 'buildinpublic', 'saashacks']
        }
      },
      status: 'pending'
    }
  ],
  'brand-3': [
    {
      id: 'rev-3-1',
      sparkId: 'spark-3-1',
      title: 'Interactive Box Breathing Reset',
      hook: 'Your neck is stiff. Your shoulders are tight. Stop scrolling.',
      description: 'A 60-second nervous system reset paired with soothing, ambient somatic frequencies. Hold for 4, exhale for 4. #breathwork #meditation #stressrelief #calm',
      tags: ['breathwork', 'meditation', 'stressrelief', 'calm'],
      videoPreviewUrl: 'https://assets.mixkit.co/videos/preview/mixkit-slow-movement-of-waves-on-the-shore-43405-large.mp4',
      audioId: 'aud-3',
      qualityChecks: [
        { id: 'qc-9', label: 'Audio Calm Profile Matching', passed: true },
        { id: 'qc-10', label: 'Dynamic Slow Expand Animation Sync', passed: true },
        { id: 'qc-11', label: 'Aspect Ratio Verification (9:16 Portrait)', passed: true }
      ],
      exportPackage: {
        mp4Url: '#',
        metadata: {
          title: '60s Somatic Release Break',
          description: 'Take a minute. Stop, drop shoulders, and let SPARK guide your breathing cycle.',
          tags: ['wellness', 'burnout', 'mindfulness']
        }
      },
      status: 'pending'
    }
  ]
};

export const mockPublishJobs: Record<string, PublishJob[]> = {
  'brand-1': [
    {
      id: 'pub-1-1',
      reviewItemId: 'rev-1-1',
      platform: 'tiktok',
      status: 'published',
      publishTime: '2026-06-30T14:00:00Z',
      engagementStats: { views: 42500, likes: 3120, comments: 144, shares: 890 }
    },
    {
      id: 'pub-1-2',
      reviewItemId: 'rev-1-1',
      platform: 'youtube_shorts',
      status: 'published',
      publishTime: '2026-06-29T10:00:00Z',
      engagementStats: { views: 18200, likes: 920, comments: 45, shares: 120 }
    },
    {
      id: 'pub-1-3',
      reviewItemId: 'rev-1-1',
      platform: 'instagram_reels',
      status: 'scheduled',
      publishTime: '2026-07-02T15:00:00Z'
    }
  ],
  'brand-2': [
    {
      id: 'pub-2-1',
      reviewItemId: 'rev-2-1',
      platform: 'instagram_reels',
      status: 'published',
      publishTime: '2026-06-28T18:00:00Z',
      engagementStats: { views: 112000, likes: 8900, comments: 312, shares: 2410 }
    }
  ],
  'brand-3': []
};

export const mockInsights: Record<string, Insight[]> = {
  'brand-1': [
    {
      id: 'ins-1-1',
      category: 'hook',
      headline: 'Negative Question Hooks performing 38% better',
      metricChange: '+38% Retention',
      description: 'Sparks starting with "Why 99% of devs fail at..." keep users past the critical 3-second mark far better than "How to use..." hooks.',
      timestamp: '2026-06-30T20:00:00Z'
    },
    {
      id: 'ins-1-2',
      category: 'pacing',
      headline: '0.8s micro-cuts double retention at midpoint',
      metricChange: '+52% Watch Time',
      description: 'Tightening the video editor cuts and applying faster text-overlay loops completely solved the dropoff at the 15-second script mark.',
      timestamp: '2026-06-28T12:00:00Z'
    }
  ],
  'brand-2': [
    {
      id: 'ins-2-1',
      category: 'audio',
      headline: 'Energetic Phonk background audio elevates Instagram engagement',
      metricChange: '+45% Share Rate',
      description: 'Connected accounts using higher BPM tracks paired with Marcus\'s punchy speaking triggers 3x more Reels shares.',
      timestamp: '2026-06-29T08:00:00Z'
    }
  ],
  'brand-3': [
    {
      id: 'ins-3-1',
      category: 'niche',
      headline: 'Soft pastel visual transitions outperform dark styles in wellness',
      metricChange: '+60% Full Completion',
      description: 'The organic ocean and drifting cloud visual assets lead to maximum complete plays.',
      timestamp: '2026-06-27T10:00:00Z'
    }
  ]
};

export const mockMemories: Record<string, Memory[]> = {
  'brand-1': [
    {
      id: 'mem-1-1',
      topic: 'Audience Preference',
      learnedFact: 'The audience strongly dislikes general AI news summaries, but loves concrete, step-by-step automation blueprint tutorials.',
      provenHypothesis: true,
      updatedAt: '2026-06-30T10:00:00Z'
    },
    {
      id: 'mem-1-2',
      topic: 'Hook Design',
      learnedFact: 'Using "ChatGPT" as the first spoken word underperforms compared to showing the tool directly on screen in the first 0.5 seconds.',
      provenHypothesis: true,
      updatedAt: '2026-06-29T15:00:00Z'
    },
    {
      id: 'mem-1-3',
      topic: 'Vocabulary Filters',
      learnedFact: 'Words like "revolutionary", "game-changing", and "insane" trigger aesthetic fatigue. Filter them out of scripts entirely.',
      provenHypothesis: true,
      updatedAt: '2026-06-25T11:00:00Z'
    }
  ],
  'brand-2': [
    {
      id: 'mem-2-1',
      topic: 'SaaS Pitch Hooks',
      learnedFact: 'Stating direct dollar amounts ($100 budget, $500 profit) in the initial hook increases click-through rates by 44%.',
      provenHypothesis: true,
      updatedAt: '2026-06-28T09:00:00Z'
    }
  ],
  'brand-3': [
    {
      id: 'mem-3-1',
      topic: 'Pacing Somatic Sync',
      learnedFact: 'The visual expanding breathing circle must exactly match a 4-second inhale and 4-second exhale rhythm to be somatically correct.',
      provenHypothesis: true,
      updatedAt: '2026-06-26T16:00:00Z'
    }
  ]
};

export const mockAssets: Record<string, Asset[]> = {
  'brand-1': [
    { id: 'as-1', name: 'Cyberpunk overlay glass shader', type: 'template', url: '#', size: '1.2 MB' },
    { id: 'as-2', name: 'Alchemist Logo PNG Vector', type: 'logo', url: '#', size: '240 KB' },
    { id: 'as-3', name: 'JetBrains Mono Bold font', type: 'font', url: '#', size: '110 KB' }
  ],
  'brand-2': [
    { id: 'as-4', name: 'Yellow banner motion graphic', type: 'template', url: '#', size: '4.5 MB' }
  ],
  'brand-3': [
    { id: 'as-5', name: 'Ambient sea waves drifting clip', type: 'video_clip', url: '#', size: '18.2 MB' }
  ]
};

export const mockAudios: Audio[] = [
  { id: 'aud-1', title: 'Midnight Synth Wave (Slowed)', artist: 'Lofi Alchemist', duration: 60, url: '#', trendingRank: 2 },
  { id: 'aud-2', title: 'Hyper Phonk Speed 2.0', artist: 'Hacker Beat', duration: 45, url: '#', trendingRank: 5 },
  { id: 'aud-3', title: 'Somatic Healing Bowl 432Hz', artist: 'Zen Soundscapes', duration: 90, url: '#', trendingRank: 12 }
];

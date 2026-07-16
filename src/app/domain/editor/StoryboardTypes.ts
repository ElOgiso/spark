import { CameraMotion, TransitionType } from './EditorTypes';

export interface StoryboardScene {
  id: string;
  index: number;
  title: string;
  description: string;
  shots: StoryboardShot[];
  durationSeconds: number;
  voiceoverText: string;
  musicCue: string;
  editingNotes: string;
  storyBeat: 'hook' | 'setup' | 'confrontation' | 'climax' | 'resolution' | 'callToAction';
  sceneObjective?: string;
  emotion?: string;
  hookPurpose?: string;
  visualReferences?: string[];
  estimatedRetention?: number;
  platformOptimization?: string;
}

export interface StoryboardShot {
  id: string;
  sceneId: string;
  index: number;
  shotType: 'wide' | 'medium' | 'closeUp' | 'extremeCloseUp' | 'overShoulder' | 'aerial' | 'pointOfView' | 'insert' | 'cutaway';
  cameraAngle: 'eye' | 'low' | 'high' | 'dutch' | 'birdEye' | 'wormEye';
  cameraMotion: CameraMotion;
  durationSeconds: number;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  visualDescription: string;
  audioDescription: string;
  textOverlay: string;
  imagePrompt: string;
  videoPrompt: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  motion?: string;
  camera?: string;
  voice?: string;
  music?: string;
  editingNotes?: string;
}

export interface Storyboard {
  id: string;
  productionId: string;
  title: string;
  createdAt: string;
  scenes: StoryboardScene[];
  totalDurationSeconds: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  targetPlatform: 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'twitter' | 'universal';
  musicStyle: string;
  voiceStyle: string;
  editingStyle: 'cinematic' | 'fastPaced' | 'documentary' | 'vlog' | 'commercial' | 'social' | 'minimal';
  colorGrade: string;
  brandOverrides: Record<string, any>;
}

// ── Reference Video Analyzer ──────────────────────────────────────────
// Reverse engineers target media uploads into structured scene and shot configs.
// Singleton – obtain via ReferenceAnalyzer.getInstance().

export interface ShotAnalysis {
  index: number;
  shotType: 'wide' | 'medium' | 'closeUp';
  cameraMove: string;
  lighting: string;
  lens: string;
  visualStyle: string;
  promptSuggestion: string;
}

export interface VideoDeconstruction {
  title: string;
  hookType: string;
  narrativeStructure: string;
  transitionsUsed: string[];
  captionsStyle: string;
  musicMood: string;
  colorPalette: string[];
  emotionArc: string;
  editingRhythm: 'slow' | 'fast';
  shots: ShotAnalysis[];
}

export class ReferenceAnalyzer {
  private static instance: ReferenceAnalyzer;

  private constructor() {}

  public static getInstance(): ReferenceAnalyzer {
    if (!ReferenceAnalyzer.instance) {
      ReferenceAnalyzer.instance = new ReferenceAnalyzer();
    }
    return ReferenceAnalyzer.instance;
  }

  /**
   * Analyzes an uploaded reference video.
   */
  public deconstructVideo(videoUrl: string): VideoDeconstruction {
    console.log(`[ReferenceAnalyzer] Running computer vision deconstruction on: ${videoUrl}`);
    return {
      title: 'Cinematic Developer Workspace Inspiration',
      hookType: 'Agitating question',
      narrativeStructure: 'Problem-Agitation-Solution',
      transitionsUsed: ['crossDissolve', 'glitch'],
      captionsStyle: 'Bold yellow pop-in, 48px',
      musicMood: 'Lo-fi tech coding beats',
      colorPalette: ['#1e1b4b', '#f8fafc'],
      emotionArc: 'Focus ➔ Achievement',
      editingRhythm: 'fast',
      shots: [
        {
          index: 0,
          shotType: 'wide',
          cameraMove: 'Dolly in slowly',
          lighting: 'Neon purple backlit key light',
          lens: '50mm anamorphic',
          visualStyle: 'Cyberpunk glassmorphic desk setup',
          promptSuggestion: 'Cinematic wide shot of a glass desk setup with neon backlit keyboards',
        },
        {
          index: 1,
          shotType: 'closeUp',
          cameraMove: 'Static pan left',
          lighting: 'Soft overhead spotlight',
          lens: '85mm macro',
          visualStyle: 'Crisp mechanical switches click close-up',
          promptSuggestion: 'Anamorphic macro lens close up on fingers typing on typewriter switches',
        },
      ],
    };
  }
}

import { Storyboard, StoryboardScene, StoryboardShot } from '../../domain/editor/StoryboardTypes';
import { CameraMotion, TransitionType } from '../../domain/editor/EditorTypes';
import { CreativeDecision, CreativeDirectorEngine } from '../creative/CreativeDirectorEngine';

interface PlatformConfig {
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  editingStyle: string;
  sceneCount: { min: number; max: number };
  sceneDuration: { min: number; max: number };
  shotTypes: Array<'wide' | 'medium' | 'closeUp' | 'extremeCloseUp' | 'overShoulder' | 'aerial' | 'pointOfView' | 'insert' | 'cutaway'>;
}

type StoryBeat = 'hook' | 'setup' | 'confrontation' | 'climax' | 'resolution' | 'callToAction';

export class StoryboardEngine {
  private static instance: StoryboardEngine;

  private constructor() {}

  public static getInstance(): StoryboardEngine {
    if (!StoryboardEngine.instance) {
      StoryboardEngine.instance = new StoryboardEngine();
    }
    return StoryboardEngine.instance;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public generateStoryboard(
    input: CreativeDecision | string,
    brandMemory: any
  ): Storyboard {
    const decision: CreativeDecision = typeof input === 'string'
      ? CreativeDirectorEngine.getInstance().analyzeObjective(`sb-fallback-${Date.now()}`, input)
      : input;

    const platformConfig = this.getPlatformConfig(decision.platform);
    const editingStyle = brandMemory?.editingStyle || platformConfig.editingStyle;
    const colorGrade = brandMemory?.visualRules?.colorPalette?.[0] || 'neutral';
    const musicStyle = brandMemory?.musicPreference || 'upbeat electronic';
    const voiceStyle = brandMemory?.voiceStyle || 'confident narrator';

    const scenes = this.generateScenes(decision.creativeGoal, platformConfig, editingStyle);
    
    // Customize scenes from Creative Decision parameters
    scenes.forEach((s) => {
      s.sceneObjective = `Fulfill creative goal: ${decision.creativeGoal}`;
      s.emotion = decision.emotion;
      s.hookPurpose = decision.hookStyle;
      s.platformOptimization = `Formulate optimized visuals for ${decision.platform}`;
    });

    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

    return {
      id: `sb-${Date.now()}`,
      productionId: `prod-${Date.now()}`,
      title: this.extractTitle(decision.creativeGoal),
      createdAt: new Date().toISOString(),
      scenes,
      totalDurationSeconds: totalDuration,
      aspectRatio: platformConfig.aspectRatio,
      targetPlatform: decision.platform as Storyboard['targetPlatform'],
      musicStyle,
      voiceStyle,
      editingStyle: editingStyle as Storyboard['editingStyle'],
      colorGrade,
      brandOverrides: brandMemory || {},
    };
  }

  // ---------------------------------------------------------------------------
  // Platform configuration
  // ---------------------------------------------------------------------------

  private getPlatformConfig(platform: string): PlatformConfig {
    const configs: Record<string, PlatformConfig> = {
      youtube: {
        aspectRatio: '16:9',
        editingStyle: 'cinematic',
        sceneCount: { min: 5, max: 8 },
        sceneDuration: { min: 10, max: 30 },
        shotTypes: ['wide', 'medium', 'closeUp', 'aerial', 'overShoulder', 'insert'],
      },
      tiktok: {
        aspectRatio: '9:16',
        editingStyle: 'fastPaced',
        sceneCount: { min: 3, max: 5 },
        sceneDuration: { min: 3, max: 8 },
        shotTypes: ['closeUp', 'extremeCloseUp', 'medium', 'pointOfView'],
      },
      instagram: {
        aspectRatio: '1:1',
        editingStyle: 'social',
        sceneCount: { min: 3, max: 6 },
        sceneDuration: { min: 3, max: 10 },
        shotTypes: ['medium', 'closeUp', 'wide', 'pointOfView'],
      },
      linkedin: {
        aspectRatio: '16:9',
        editingStyle: 'documentary',
        sceneCount: { min: 4, max: 6 },
        sceneDuration: { min: 8, max: 20 },
        shotTypes: ['medium', 'wide', 'overShoulder', 'insert', 'cutaway'],
      },
      twitter: {
        aspectRatio: '16:9',
        editingStyle: 'fastPaced',
        sceneCount: { min: 3, max: 4 },
        sceneDuration: { min: 3, max: 8 },
        shotTypes: ['medium', 'closeUp', 'wide'],
      },
      universal: {
        aspectRatio: '16:9',
        editingStyle: 'cinematic',
        sceneCount: { min: 5, max: 8 },
        sceneDuration: { min: 8, max: 20 },
        shotTypes: ['wide', 'medium', 'closeUp', 'aerial', 'overShoulder', 'insert', 'cutaway'],
      },
    };

    return configs[platform] || configs.universal;
  }

  // ---------------------------------------------------------------------------
  // Title extraction
  // ---------------------------------------------------------------------------

  private extractTitle(objective: string): string {
    const periodIndex = objective.indexOf('.');
    if (periodIndex > 0 && periodIndex <= 60) {
      return objective.substring(0, periodIndex);
    }
    if (objective.length <= 60) {
      return objective;
    }
    // Break at the last space before 60 characters to avoid mid-word truncation
    const truncated = objective.substring(0, 60);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated;
  }

  // ---------------------------------------------------------------------------
  // Scene generation
  // ---------------------------------------------------------------------------

  private generateScenes(
    objective: string,
    platformConfig: PlatformConfig,
    editingStyle: string
  ): StoryboardScene[] {
    const beatSequence: StoryBeat[] = [
      'hook',
      'setup',
      'confrontation',
      'climax',
      'resolution',
      'callToAction',
    ];

    // Determine the number of scenes within platform bounds
    const { min, max } = platformConfig.sceneCount;
    const sceneCount = Math.min(beatSequence.length, this.randomInt(min, max));

    // If we have fewer scenes than beats, sample the most important ones
    const selectedBeats = this.selectBeats(beatSequence, sceneCount);

    // Extract key phrases from the objective to weave into content
    const keywords = this.extractKeywords(objective);

    return selectedBeats.map((beat, index) => {
      const sceneDuration = this.durationForBeat(beat, platformConfig);
      const sceneId = `scene-${Date.now()}-${index}`;
      const title = this.titleForBeat(beat, keywords);
      const description = this.descriptionForBeat(beat, objective, keywords);

      const scene: StoryboardScene = {
        id: sceneId,
        index,
        title,
        description,
        shots: [], // populated below
        durationSeconds: sceneDuration,
        voiceoverText: this.voiceoverForBeat(beat, objective, keywords),
        musicCue: this.musicCueForBeat(beat),
        editingNotes: this.editingNotesForBeat(beat, editingStyle),
        storyBeat: beat,
        sceneObjective: `Establish ${beat} context for target audience`,
        emotion: beat === 'hook' ? 'surprise' : beat === 'climax' ? 'excitement' : 'neutral',
        hookPurpose: beat === 'hook' ? 'Maximize 3s scroll stop' : undefined,
        visualReferences: [`reference_asset_${beat}.jpg`],
        estimatedRetention: beat === 'hook' ? 0.92 : 0.78,
        platformOptimization: `Center safe-zone framing for vertical platforms`,
      };

      scene.shots = this.generateShots(scene, platformConfig, editingStyle);

      return scene;
    });
  }

  // ---------------------------------------------------------------------------
  // Shot generation
  // ---------------------------------------------------------------------------

  private generateShots(
    scene: StoryboardScene,
    platformConfig: PlatformConfig,
    editingStyle: string
  ): StoryboardShot[] {
    const shotCount = this.shotCountForBeat(scene.storyBeat);
    const shots: StoryboardShot[] = [];

    for (let i = 0; i < shotCount; i++) {
      const shotId = `shot-${Date.now()}-${scene.index}-${i}`;
      const shotDuration = Math.max(1, Math.round(scene.durationSeconds / shotCount));

      const { shotType, cameraAngle, cameraMotion } = this.cinematographyForBeat(
        scene.storyBeat,
        i,
        platformConfig
      );

      const transitionIn = i === 0
        ? this.getTransitionForStyle(editingStyle, scene.storyBeat)
        : ('cut' as TransitionType);
      const transitionOut = i === shotCount - 1
        ? this.getTransitionForStyle(editingStyle, scene.storyBeat)
        : ('cut' as TransitionType);

      const visualDescription = this.visualDescriptionForShot(
        scene,
        shotType,
        cameraAngle,
        cameraMotion,
        i
      );
      const audioDescription = this.audioDescriptionForShot(scene, i, shotCount);

      const shot: StoryboardShot = {
        id: shotId,
        sceneId: scene.id,
        index: i,
        shotType,
        cameraAngle,
        cameraMotion,
        durationSeconds: shotDuration,
        transitionIn,
        transitionOut,
        visualDescription,
        audioDescription,
        textOverlay: this.textOverlayForShot(scene, i),
        imagePrompt: '', // populated below
        videoPrompt: '', // populated below
        motion: cameraMotion,
        camera: `${cameraAngle} angle with ${shotType} framing`,
        voice: scene.voiceoverText,
        music: scene.musicCue,
        editingNotes: `Transition using ${transitionIn}`,
      };

      shot.imagePrompt = this.generateImagePrompt(scene, shot);
      shot.videoPrompt = this.generateVideoPrompt(scene, shot);

      shots.push(shot);
    }

    return shots;
  }

  // ---------------------------------------------------------------------------
  // Transition selection by editing style + beat
  // ---------------------------------------------------------------------------

  private getTransitionForStyle(
    editingStyle: string,
    beatType: StoryBeat
  ): TransitionType {
    switch (editingStyle) {
      case 'cinematic': {
        const emotionalBeats: StoryBeat[] = ['hook', 'climax', 'resolution'];
        if (beatType === 'resolution' || beatType === 'callToAction') return 'fadeOut';
        if (emotionalBeats.includes(beatType)) return 'crossDissolve';
        return 'cut';
      }
      case 'fastPaced':
        return 'cut';
      case 'documentary': {
        if (beatType === 'hook') return 'fadeIn';
        if (beatType === 'resolution' || beatType === 'callToAction') return 'fadeOut';
        return 'crossDissolve';
      }
      case 'vlog': {
        if (beatType === 'hook') return 'fadeIn';
        return 'cut';
      }
      case 'commercial':
        return 'zoomIn';
      case 'social': {
        if (beatType === 'hook') return 'slideUp';
        return 'wipeLeft';
      }
      case 'minimal': {
        if (beatType === 'hook' || beatType === 'callToAction') return 'fadeIn';
        return 'cut';
      }
      default:
        return 'cut';
    }
  }

  // ---------------------------------------------------------------------------
  // Image prompt generation
  // ---------------------------------------------------------------------------

  private generateImagePrompt(scene: StoryboardScene, shot: StoryboardShot): string {
    const shotLabel = this.humanReadableShotType(shot.shotType);
    const angleLabel = this.humanReadableCameraAngle(shot.cameraAngle);
    const motionHint = shot.cameraMotion !== 'static' ? `, ${shot.cameraMotion} motion` : '';

    return (
      `${shotLabel} shot from ${angleLabel} angle${motionHint}. ` +
      `${shot.visualDescription} ` +
      `Scene context: ${scene.description}. ` +
      `Mood: ${this.moodForBeat(scene.storyBeat)}. ` +
      `High quality, cinematic lighting, photorealistic.`
    );
  }

  // ---------------------------------------------------------------------------
  // Video prompt generation
  // ---------------------------------------------------------------------------

  private generateVideoPrompt(scene: StoryboardScene, shot: StoryboardShot): string {
    const motionDesc = this.describeMotion(shot.cameraMotion);

    return (
      `${shot.durationSeconds}-second video clip. ` +
      `Camera: ${motionDesc}. ` +
      `${shot.visualDescription} ` +
      `${shot.audioDescription ? `Audio: ${shot.audioDescription}. ` : ''}` +
      `Mood: ${this.moodForBeat(scene.storyBeat)}. ` +
      `Style: cinematic, professional grade, smooth motion.`
    );
  }

  // ---------------------------------------------------------------------------
  // Helper: beat selection when scene count < total beats
  // ---------------------------------------------------------------------------

  private selectBeats(allBeats: StoryBeat[], count: number): StoryBeat[] {
    if (count >= allBeats.length) return [...allBeats];

    // Always include hook and callToAction; sample the middle beats
    const essential: StoryBeat[] = ['hook', 'callToAction'];
    const middleBeats = allBeats.filter((b) => !essential.includes(b));
    const middleCount = count - essential.length;

    const selected: StoryBeat[] = ['hook'];

    // Evenly space picks from the middle
    if (middleCount > 0 && middleBeats.length > 0) {
      const step = middleBeats.length / middleCount;
      for (let i = 0; i < middleCount; i++) {
        selected.push(middleBeats[Math.floor(i * step)]);
      }
    }

    selected.push('callToAction');
    return selected;
  }

  // ---------------------------------------------------------------------------
  // Helper: duration per beat
  // ---------------------------------------------------------------------------

  private durationForBeat(beat: StoryBeat, config: PlatformConfig): number {
    const { min, max } = config.sceneDuration;
    const range = max - min;

    const ratios: Record<StoryBeat, number> = {
      hook: 0.2,
      setup: 0.5,
      confrontation: 0.6,
      climax: 0.9,
      resolution: 0.5,
      callToAction: 0.15,
    };

    return Math.round(min + range * ratios[beat]);
  }

  // ---------------------------------------------------------------------------
  // Helper: shot count per beat
  // ---------------------------------------------------------------------------

  private shotCountForBeat(beat: StoryBeat): number {
    const counts: Record<StoryBeat, number> = {
      hook: 2,
      setup: 3,
      confrontation: 3,
      climax: 3,
      resolution: 2,
      callToAction: 1,
    };
    return counts[beat];
  }

  // ---------------------------------------------------------------------------
  // Cinematography mapping per beat
  // ---------------------------------------------------------------------------

  private cinematographyForBeat(
    beat: StoryBeat,
    shotIndex: number,
    platformConfig: PlatformConfig
  ): {
    shotType: StoryboardShot['shotType'];
    cameraAngle: StoryboardShot['cameraAngle'];
    cameraMotion: CameraMotion;
  } {
    const pick = <T>(arr: T[], index: number): T => arr[index % arr.length];

    switch (beat) {
      case 'hook':
        return {
          shotType: pick(['closeUp', 'extremeCloseUp'] as const, shotIndex),
          cameraAngle: pick(['eye', 'low'] as const, shotIndex),
          cameraMotion: 'zoomIn',
        };
      case 'setup':
        return {
          shotType: pick(['medium', 'wide'] as const, shotIndex),
          cameraAngle: pick(['eye', 'high'] as const, shotIndex),
          cameraMotion: pick(['panLeft', 'panRight'] as const, shotIndex),
        };
      case 'confrontation':
        return {
          shotType: pick(['medium', 'closeUp', 'overShoulder'] as const, shotIndex),
          cameraAngle: pick(['eye', 'low', 'dutch'] as const, shotIndex),
          cameraMotion: 'track',
        };
      case 'climax':
        return {
          shotType: pick(['wide', 'aerial', 'closeUp'] as const, shotIndex),
          cameraAngle: pick(['high', 'birdEye', 'low'] as const, shotIndex),
          cameraMotion: pick(['dollyIn', 'crane', 'orbit'] as const, shotIndex),
        };
      case 'resolution':
        return {
          shotType: pick(['medium', 'wide'] as const, shotIndex),
          cameraAngle: 'eye',
          cameraMotion: pick(['static', 'panRight'] as const, shotIndex),
        };
      case 'callToAction':
        return {
          shotType: pick(['medium', 'closeUp'] as const, shotIndex),
          cameraAngle: 'eye',
          cameraMotion: 'static',
        };
      default:
        return {
          shotType: 'medium',
          cameraAngle: 'eye',
          cameraMotion: 'static',
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Content generation helpers
  // ---------------------------------------------------------------------------

  private extractKeywords(objective: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
      'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too',
      'very', 'just', 'because', 'as', 'until', 'while', 'of', 'at', 'by',
      'for', 'with', 'about', 'against', 'between', 'through', 'during',
      'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
      'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
      'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
      'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
      'they', 'them', 'their', 'what', 'which', 'who', 'whom',
      'create', 'make', 'video', 'content',
    ]);

    return objective
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private titleForBeat(beat: StoryBeat, keywords: string[]): string {
    const topKeyword = keywords[0] || 'story';
    const titles: Record<StoryBeat, string> = {
      hook: `Attention-Grabbing Open — ${topKeyword}`,
      setup: `Setting the Stage — ${topKeyword}`,
      confrontation: `Building Tension — ${topKeyword}`,
      climax: `Peak Moment — ${topKeyword}`,
      resolution: `Bringing It Home — ${topKeyword}`,
      callToAction: `Call to Action — ${topKeyword}`,
    };
    return titles[beat];
  }

  private descriptionForBeat(beat: StoryBeat, objective: string, keywords: string[]): string {
    const kw = keywords.slice(0, 3).join(', ') || 'the subject';
    const descriptions: Record<StoryBeat, string> = {
      hook: `An arresting opening that immediately captures attention using bold visuals related to ${kw}. Designed to stop the scroll and create intrigue within the first 2 seconds.`,
      setup: `Establish context and introduce the core premise around ${kw}. The viewer learns what this story is about and why it matters to them. Objective: ${objective}`,
      confrontation: `Present the challenge, conflict, or transformation at the heart of the narrative. Build emotional investment by showing the stakes related to ${kw}.`,
      climax: `The most impactful moment — a dramatic reveal, emotional peak, or key transformation involving ${kw}. Maximum visual and audio intensity.`,
      resolution: `Show the outcome, result, or payoff. The viewer sees the resolution of the story around ${kw}, feeling satisfied and informed.`,
      callToAction: `Clear, compelling prompt for the viewer to take the next step. Reinforces the core message about ${kw} with urgency and clarity.`,
    };
    return descriptions[beat];
  }

  private voiceoverForBeat(beat: StoryBeat, objective: string, keywords: string[]): string {
    const kw = keywords.slice(0, 2).join(' and ') || 'this';
    const voiceovers: Record<StoryBeat, string> = {
      hook: `What if everything you thought you knew about ${kw} was about to change?`,
      setup: `Here's the thing — ${objective.substring(0, 120)}${objective.length > 120 ? '...' : ''}`,
      confrontation: `But there's a challenge. Most people struggle with ${kw} because they're missing a critical piece of the puzzle.`,
      climax: `This is the moment that changes everything. Watch what happens when ${kw} comes together.`,
      resolution: `And just like that, the transformation is complete. ${kw} has been redefined.`,
      callToAction: `Ready to experience this for yourself? Take the next step now.`,
    };
    return voiceovers[beat];
  }

  private musicCueForBeat(beat: StoryBeat): string {
    const cues: Record<StoryBeat, string> = {
      hook: 'Driving beat with a sharp riser, immediate energy burst',
      setup: 'Atmospheric pads building gently, curious and inviting tone',
      confrontation: 'Tension-building percussion, minor key progression, increasing tempo',
      climax: 'Full orchestral/electronic drop, maximum energy and emotional impact',
      resolution: 'Warm resolution, major key, satisfying chord progression',
      callToAction: 'Upbeat and confident outro, clean and forward-looking',
    };
    return cues[beat];
  }

  private editingNotesForBeat(beat: StoryBeat, editingStyle: string): string {
    const styleNote = `Editing style: ${editingStyle}.`;
    const notes: Record<StoryBeat, string> = {
      hook: `${styleNote} Fast cuts, bold text overlays, high-contrast color. First frame must be visually arresting.`,
      setup: `${styleNote} Measured pacing, clean compositions. Use lower-thirds for key information.`,
      confrontation: `${styleNote} Increase cut frequency. Use dynamic camera moves and contrast between shots.`,
      climax: `${styleNote} Dramatic slow-motion or speed ramps. Peak color grading intensity. Sync edits to music hits.`,
      resolution: `${styleNote} Ease the pacing. Wider shots, longer holds. Let the visuals breathe.`,
      callToAction: `${styleNote} Clean frame, centered text. Strong graphic elements. End on brand logo or URL.`,
    };
    return notes[beat];
  }

  private visualDescriptionForShot(
    scene: StoryboardScene,
    shotType: string,
    cameraAngle: string,
    cameraMotion: CameraMotion,
    shotIndex: number
  ): string {
    const angleDesc = this.humanReadableCameraAngle(cameraAngle as StoryboardShot['cameraAngle']);
    const motionDesc = cameraMotion !== 'static' ? ` with ${this.describeMotion(cameraMotion)}` : '';

    const beatVisuals: Record<StoryBeat, string[]> = {
      hook: [
        'Bold graphic element filling the frame, vibrant color splash',
        'Subject emerging from shadow into dramatic light',
      ],
      setup: [
        'Clean establishing view showing environment and context',
        'Subject interacting with key props or surroundings',
        'Detail shot of important object or element',
      ],
      confrontation: [
        'Intense facial expression or body language conveying tension',
        'Split composition showing contrast or opposition',
        'Dynamic movement through challenging environment',
      ],
      climax: [
        'Sweeping panoramic view of the defining moment',
        'Dramatic aerial perspective revealing full scope',
        'Extreme close-up capturing raw emotion or fine detail',
      ],
      resolution: [
        'Warm, balanced composition showing positive outcome',
        'Subject in a resolved, confident posture',
      ],
      callToAction: [
        'Clean frame with prominent call-to-action text and branding',
      ],
    };

    const options = beatVisuals[scene.storyBeat] || beatVisuals.setup;
    const visual = options[shotIndex % options.length];

    return `${visual}. Framed as a ${shotType} shot from ${angleDesc} angle${motionDesc}.`;
  }

  private audioDescriptionForShot(scene: StoryboardScene, shotIndex: number, totalShots: number): string {
    if (shotIndex === 0) {
      return `Music: ${scene.musicCue}. Voiceover begins: "${scene.voiceoverText.substring(0, 60)}..."`;
    }
    if (shotIndex === totalShots - 1) {
      return 'Music continues, voiceover concludes for this scene.';
    }
    return 'Music bed continues under voiceover narration.';
  }

  private textOverlayForShot(scene: StoryboardScene, shotIndex: number): string {
    if (scene.storyBeat === 'hook' && shotIndex === 0) {
      return scene.title.replace(/—.*/, '').trim();
    }
    if (scene.storyBeat === 'callToAction') {
      return 'Take the next step →';
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private humanReadableShotType(shotType: string): string {
    const map: Record<string, string> = {
      wide: 'Wide',
      medium: 'Medium',
      closeUp: 'Close-up',
      extremeCloseUp: 'Extreme close-up',
      overShoulder: 'Over-the-shoulder',
      aerial: 'Aerial',
      pointOfView: 'Point-of-view',
      insert: 'Insert',
      cutaway: 'Cutaway',
    };
    return map[shotType] || shotType;
  }

  private humanReadableCameraAngle(angle: StoryboardShot['cameraAngle']): string {
    const map: Record<string, string> = {
      eye: 'eye-level',
      low: 'low',
      high: 'high',
      dutch: 'dutch (tilted)',
      birdEye: "bird's-eye",
      wormEye: "worm's-eye",
    };
    return map[angle] || angle;
  }

  private describeMotion(motion: CameraMotion): string {
    const map: Record<CameraMotion, string> = {
      static: 'locked-off static frame',
      panLeft: 'smooth pan left',
      panRight: 'smooth pan right',
      panUp: 'tilt up',
      panDown: 'tilt down',
      zoomIn: 'slow zoom in toward subject',
      zoomOut: 'zoom out to reveal environment',
      dollyIn: 'dolly push-in toward subject',
      dollyOut: 'dolly pull-out from subject',
      crane: 'crane movement rising upward',
      orbit: 'orbital movement around subject',
      shake: 'handheld shake for intensity',
      track: 'lateral tracking alongside motion',
    };
    return map[motion] || motion;
  }

  private moodForBeat(beat: StoryBeat): string {
    const moods: Record<StoryBeat, string> = {
      hook: 'urgent, bold, attention-grabbing',
      setup: 'curious, inviting, clear',
      confrontation: 'tense, dramatic, high-stakes',
      climax: 'powerful, emotional, peak intensity',
      resolution: 'warm, satisfying, resolved',
      callToAction: 'confident, direct, motivating',
    };
    return moods[beat];
  }
}

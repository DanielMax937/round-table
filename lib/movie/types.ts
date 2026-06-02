/** Story proposal generated from theme */
export interface StoryProposal {
  oneLiner: string;
  coreConflict: string;
  styleReference: string;
  synopsis: string;
}

export interface ScreenplayPromptPack {
  immutableFacts: string[];
  characterRules: string[];
  requiredScenes: string[];
  safeToChange: string[];
  dangerZones: string[];
  visualAnchors: string[];
  rewritePriorities: string[];
}

export interface DevelopmentReport {
  quickDiagnosis: {
    grade: 'A' | 'B' | 'C' | 'D' | 'D0';
    reason: string;
    biggestOpportunity: string;
    biggestRisk: string;
  };
  projectInfo: {
    title: string;
    genre: string;
    tone: string;
    targetAudience: string;
    logline: string;
  };
  premise: {
    coreConflict: string;
    theme: string;
    dramaticQuestion: string;
    transformation: string;
  };
  structure: {
    actOne: string;
    actTwo: string;
    actThree: string;
    turningPoints: string[];
  };
  characterAnalysis: Array<{
    name: string;
    function: string;
    motivation: string;
    arc: string;
    relationshipPressure: string;
  }>;
  adaptationPotential: {
    visualValue: string;
    productionNotes: string;
    adaptationChallenges: string[];
  };
  marketPositioning: {
    comparableWorks: string[];
    sellingPoints: string[];
    audienceHook: string;
  };
  developmentRecommendations: string[];
  screenplayPromptPack: ScreenplayPromptPack;
}

export interface StoryArc {
  act: string;
  arcName: string;
  objective: string;
  keyResults: string[];
  emotionalCurve: string;
  setupPayoffs: string[];
  visualMotifs: string[];
}

export interface StoryBible {
  controllingIdea: string;
  worldRules: string[];
  toneRules: string[];
  arcs: StoryArc[];
  characterDesignRules: string[];
  hookLedger: Array<{
    hook: string;
    plantedIn: string;
    payoffBy: string;
    status: 'planned' | 'open' | 'resolved';
  }>;
  objectMotifs: string[];
  doNotBreak: string[];
  screenplayPromptPack: ScreenplayPromptPack;
}

/** Character profile for screenplay */
export interface CharacterProfile {
  name: string;
  surfaceGoal: string;
  deepMotivation: string;
  fatalFlaw: string;
  signatureLanguageStyle: string;
  backstory: string;
  personalityTraits: string;
}

/** Scene outline item */
export interface SceneOutlineItem {
  title: string;
  contentSummary: string;
  emotionalGoal: string;
  characterIds: string[];
  act?: string;
  arcName?: string;
  arcGoal?: string;
  setupPayoff?: string;
  requiredMotif?: string;
}

/** Character current state (updated per scene) */
export interface CharacterState {
  emotionalState?: string;
  physicalState?: string;
  knowledge?: string[];
}

/** Story proposal generated from theme */
export interface StoryProposal {
  oneLiner: string;
  coreConflict: string;
  styleReference: string;
  synopsis: string;
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
}

/** Character current state (updated per scene) */
export interface CharacterState {
  emotionalState?: string;
  physicalState?: string;
  knowledge?: string[];
}

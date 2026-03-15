/**
 * Parse screenplay into narration and per-character dialogue blocks.
 * Used for sending each character's reply as a separate Telegram message.
 *
 * Supports:
 * - Standard screenplay: CHARACTER NAME on own line, then dialogue
 * - Inline format: 角色: 对话 or CHARACTER: dialogue
 */

export interface DialogueBlock {
  character: string;
  content: string; // dialogue text (may include parenthetical)
}

export interface ParsedScript {
  /** Intro/narration before first dialogue */
  intro: string;
  /** Dialogue blocks in order */
  dialogues: DialogueBlock[];
}

/** Inline pattern: 林宛: 我错了。 or ALICE: Hello. */
const INLINE_DIALOGUE = /^([\u4e00-\u9fa5]{2,4}|[A-Z][A-Z\s\.]+):\s*(.*)$/;

/**
 * Detect if a line is a character name (start of dialogue block).
 * - English: ALL CAPS, e.g. LIN WAN, LI XIUQIN
 * - Chinese: 2-4 chars, e.g. 林宛, 李秀琴
 * - With parenthetical: LI XIUQIN (20, sharp-eyed)
 */
function isCharacterNameLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Skip scene headings
  if (/^(INT\.|EXT\.|INT\/EXT\.)/i.test(t)) return false;
  // Skip inline dialogue (handled separately)
  if (INLINE_DIALOGUE.test(t)) return false;
  // English: all caps, possibly with spaces/dots, optional (parenthetical)
  if (/^[A-Z][A-Z\s\.]+(\([^)]*\))?\s*$/.test(t)) return true;
  // Chinese name: 2-4 chars, optional （）parenthetical
  if (/^[\u4e00-\u9fa5]{2,4}(\s*[（(][^）)]*[）)])?\s*$/.test(t)) return true;
  return false;
}

/**
 * Parse screenplay into intro + dialogue blocks.
 * Handles both standard screenplay format and inline "角色: 对话" format.
 */
export function parseScreenplayDialogue(script: string): ParsedScript {
  const lines = script.split(/\r?\n/);
  const dialogues: DialogueBlock[] = [];
  let intro = '';
  let currentBlock: { character: string; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Inline format: 林宛: 我错了。
    const inlineMatch = trimmed.match(INLINE_DIALOGUE);
    if (inlineMatch && !/^(INT\.|EXT\.|INT\/EXT\.)/i.test(trimmed)) {
      if (currentBlock) {
        dialogues.push({
          character: currentBlock.character,
          content: currentBlock.lines.join('\n').trim(),
        });
      }
      const charName = inlineMatch[1].trim();
      const dialogue = inlineMatch[2].trim();
      dialogues.push({ character: charName, content: dialogue });
      currentBlock = null;
      continue;
    }

    if (isCharacterNameLine(line) && trimmed) {
      if (currentBlock) {
        dialogues.push({
          character: currentBlock.character,
          content: currentBlock.lines.join('\n').trim(),
        });
      }
      const nameMatch = trimmed.match(/^([\u4e00-\u9fa5]{2,4}|[A-Z][A-Z\s\.]+)/);
      const charName = nameMatch ? nameMatch[1].trim() : trimmed;
      currentBlock = { character: charName, lines: [line] };
      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    } else {
      if (intro) intro += '\n';
      intro += line;
    }
  }

  if (currentBlock) {
    dialogues.push({
      character: currentBlock.character,
      content: currentBlock.lines.join('\n').trim(),
    });
  }

  return { intro: intro.trim(), dialogues };
}

/**
 * Format dialogue block for display (e.g. Telegram).
 * Returns "角色: 对话内容" — parentheticals are kept in content.
 */
export function formatDialogueForMessage(block: DialogueBlock): string {
  return `${block.character}: ${block.content}`;
}

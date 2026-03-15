import { parseScreenplayDialogue, formatDialogueForMessage } from '../script-parser';

describe('parseScreenplayDialogue', () => {
  it('parses inline format (角色: 对话)', () => {
    const script = `INT. ROOM - DAY

林宛: 我错了。
李秀琴: 你知道就好。`;
    const { intro, dialogues } = parseScreenplayDialogue(script);
    expect(intro).toContain('INT. ROOM - DAY');
    expect(dialogues).toHaveLength(2);
    expect(dialogues[0]).toEqual({ character: '林宛', content: '我错了。' });
    expect(dialogues[1]).toEqual({ character: '李秀琴', content: '你知道就好。' });
  });

  it('parses standard screenplay format', () => {
    const script = `INT. OFFICE - DAY

林宛 enters.

林宛
(softly)
我错了。

李秀琴
你知道就好。`;
    const { intro, dialogues } = parseScreenplayDialogue(script);
    expect(intro).toContain('INT. OFFICE - DAY');
    expect(intro).toContain('林宛 enters.');
    expect(dialogues).toHaveLength(2);
    expect(dialogues[0].character).toBe('林宛');
    expect(dialogues[0].content).toContain('(softly)');
    expect(dialogues[0].content).toContain('我错了。');
    expect(dialogues[1].character).toBe('李秀琴');
    expect(dialogues[1].content).toContain('你知道就好。');
  });

  it('parses English inline format', () => {
    const script = `ALICE: Hello.
BOB: Hi.`;
    const { intro, dialogues } = parseScreenplayDialogue(script);
    expect(intro).toBe('');
    expect(dialogues).toHaveLength(2);
    expect(dialogues[0]).toEqual({ character: 'ALICE', content: 'Hello.' });
    expect(dialogues[1]).toEqual({ character: 'BOB', content: 'Hi.' });
  });

  it('formats dialogue for message', () => {
    expect(formatDialogueForMessage({ character: '林宛', content: '我错了。' })).toBe(
      '林宛: 我错了。'
    );
  });
});

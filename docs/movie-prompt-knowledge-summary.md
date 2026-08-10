# Movie Prompt Knowledge Summary

This project uses the local `movie/` wiki as a reference source only. The wiki itself is ignored by Git; the application keeps distilled production rules in code prompts.

Additional image prompt patterns were cross-checked against the local `awesome-gpt-image-2-API-and-Prompts/` download. The full repository is ignored by Git; only generalized prompt construction rules are retained.

## Image Generation Rules

- Use structured prompting instead of loose prose: `FORMAT`, `SUBJECTS`, `ENVIRONMENT`, `COMPOSITION`, `LIGHTING`, `CONTINUITY`, `NEGATIVE CONSTRAINTS`.
- Separate variables so the image model can resolve them independently: style, identity, environment, camera, action, and light should not be fused into one long sentence.
- Keep image prompts production-facing: frame type, aspect ratio, shot size, camera height, lens feel, blocking, practical light, and a small number of readable props.
- Preserve continuity anchors for later image-to-video use: face, hair, wardrobe, key prop, room layout, and color temperature.
- Avoid visual mud. Remove redundant texture lists and decorative adjectives unless they directly affect story, identity, blocking, or light.
- For character look boards, use clear board zones: front view, side/profile cue, expression detail, wardrobe/material swatches, and one prop cue.
- For storyboard or multi-panel images, every panel must be an independent shot source, not one fused composition.
- Start with a concrete task verb: create, transform, preserve, restage, or design.
- When using a reference image or prior visual design, explicitly name the preserved identity, pose, outfit, composition, product, or layout.
- For storyboard sheets, specify the exact panel count, panel order, panel borders, captions/timestamps if required, and one action beat per panel.
- For poster or ad-like images, use a clear `WHAT / FEEL / SHOW / TYPOGRAPHY / TECHNICAL` split so the model can separate subject, atmosphere, key moment, text hierarchy, and rendering style.
- Treat text intentionally: if required, specify exact words, language, placement, hierarchy, and reserved space; otherwise forbid random text.
- Use concrete visible material details sparingly, such as fabric wrinkles, glass glare, wet reflections, paper grain, steam, smoke, or skin pores.
- For complex boards, JSON-like or labeled-block prompts are acceptable when they lock layout better than prose.
- Lock exact counts and positions: panel count, prop count, badge/label count, character count, section order, foreground/midground/background placement, and title/caption locations.
- Avoid vague quantity words such as many or several when the image depends on count accuracy; list the required objects or panels explicitly.
- Character sheets work best as neutral production boards: front, side/profile, back or 3/4 view, expression row, costume/equipment breakdown, material swatches, color palette, and one role/worldbuilding note.
- Poster/key-art prompts should name the visual skeleton: negative space, dominant flow line, silhouette or double-exposure shape, hero subject, embedded story details, and clear typography slot.
- UI, infographic, and social mockup examples show that text-heavy images need a fixed section map and exact strings; otherwise text should be excluded.

## Video Generation Rules

- Use structured video prompting: `FORMAT`, `FIRST-FRAME ANCHOR`, `CAMERA PATH`, `SUBJECT MOTION`, `TIME BEATS`, `CONTINUITY LOCKS`, `NEGATIVE CONSTRAINTS`.
- Treat a source image as the first-frame anchor. Preserve composition, identity, wardrobe, props, geography, and color temperature.
- Prefer one continuous shot by default. If a multi-shot sequence is required, decompose it into explicit shot segments with clean cut or match-cut logic.
- Define one motivated camera movement only: shot size, camera height, lens feel, stabilization, speed, and path.
- Break action into exact time beats, changing only one or two dimensions at a time: camera, actor intention, object state, or facial expression.
- Keep hand/object interactions simple, already-settled, or slow enough for the model to preserve anatomy.
- For storyboard/grid references, never treat the grid as one image; convert selected panels into sequential shot sources or use the first relevant panel as the anchor.

## Seedance 2.0 Skill OS Integration

The full `github.com/Emily2040/seedance-2.0` repository is vendored under `third_party/seedance-2.0`. Runtime prompt generation loads selected upstream `SKILL.md` and `references/*.md` files through `lib/movie/seedance-skill-os.ts`, then `lib/movie/seedance-prompt-compiler.ts` combines that real Skill OS context with the current movie state.

- Classify generation mode before drafting: `T2V` for text-only jobs, `I2V` for one source image, and `R2V` for multiple references.
- Assign reference roles explicitly with exact Chinese tags such as `@图片1`; each reference gets a primary transfer role and a do-not-transfer boundary.
- For requests longer than one reliable Seedance generation, compile only the current clip and mark it as the first sequence clip. Future beats stay out of the prompt.
- Preserve the user-selected aspect ratio in prompt context instead of hard-coding `16:9`.
- Keep final Seedance prompts as natural Chinese prose, not JSON/YAML, while the compiler can use structured planning internally.
- Validate vendored upstream skills, references, schemas, examples, assets, and scripts with `npm run seedance:validate`.
- Apply safety rewriting guidance before final prompt output: protected IP, celebrity likeness, private-person identity, brand/logo, song, or voice mimicry should be converted to original production-safe equivalents.

## Quality Implication

The generated prompts should be judged by whether they are executable production instructions, not whether they sound cinematic. Good prompts reduce ambiguity, lock continuity, constrain motion, and make failure modes explicit.

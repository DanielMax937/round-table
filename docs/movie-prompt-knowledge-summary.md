# Movie Prompt Knowledge Summary

This project uses the local `movie/` wiki as a reference source only. The wiki itself is ignored by Git; the application keeps distilled production rules in code prompts.

## Image Generation Rules

- Use structured prompting instead of loose prose: `FORMAT`, `SUBJECTS`, `ENVIRONMENT`, `COMPOSITION`, `LIGHTING`, `CONTINUITY`, `NEGATIVE CONSTRAINTS`.
- Separate variables so the image model can resolve them independently: style, identity, environment, camera, action, and light should not be fused into one long sentence.
- Keep image prompts production-facing: frame type, aspect ratio, shot size, camera height, lens feel, blocking, practical light, and a small number of readable props.
- Preserve continuity anchors for later image-to-video use: face, hair, wardrobe, key prop, room layout, and color temperature.
- Avoid visual mud. Remove redundant texture lists and decorative adjectives unless they directly affect story, identity, blocking, or light.
- For character look boards, use clear board zones: front view, side/profile cue, expression detail, wardrobe/material swatches, and one prop cue.
- For storyboard or multi-panel images, every panel must be an independent shot source, not one fused composition.

## Video Generation Rules

- Use structured video prompting: `FORMAT`, `FIRST-FRAME ANCHOR`, `CAMERA PATH`, `SUBJECT MOTION`, `TIME BEATS`, `CONTINUITY LOCKS`, `NEGATIVE CONSTRAINTS`.
- Treat a source image as the first-frame anchor. Preserve composition, identity, wardrobe, props, geography, and color temperature.
- Prefer one continuous shot by default. If a multi-shot sequence is required, decompose it into explicit shot segments with clean cut or match-cut logic.
- Define one motivated camera movement only: shot size, camera height, lens feel, stabilization, speed, and path.
- Break action into exact time beats, changing only one or two dimensions at a time: camera, actor intention, object state, or facial expression.
- Keep hand/object interactions simple, already-settled, or slow enough for the model to preserve anatomy.
- For storyboard/grid references, never treat the grid as one image; convert selected panels into sequential shot sources or use the first relevant panel as the anchor.

## Quality Implication

The generated prompts should be judged by whether they are executable production instructions, not whether they sound cinematic. Good prompts reduce ambiguity, lock continuity, constrain motion, and make failure modes explicit.

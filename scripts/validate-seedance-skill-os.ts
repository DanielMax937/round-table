import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Check {
  label: string;
  command: string;
  args: string[];
}

const projectRoot = process.cwd();
const seedanceRoot = path.join(projectRoot, 'third_party', 'seedance-2.0');
const python = process.env.PYTHON || 'python3';

const checks: Check[] = [
  { label: 'Validate skill metadata and required files', command: python, args: ['scripts/validate_skills.py', '--strict'] },
  { label: 'Audit stale and risky active wording', command: python, args: ['scripts/content_audit.py', '--strict'] },
  { label: 'Validate eval schema', command: python, args: ['scripts/eval_schema_check.py', '--strict'] },
  { label: 'Audit README and visual assets', command: python, args: ['scripts/design_audit.py', '--strict'] },
  { label: 'Validate source freshness and claim labels', command: python, args: ['scripts/source_registry_check.py', '--strict'] },
  { label: 'Validate multilingual vocabulary schema', command: python, args: ['scripts/vocab_schema_check.py', '--strict'] },
  { label: 'Validate sequence project state', command: python, args: ['scripts/project_state_check.py', '--strict'] },
  { label: 'Validate continuity chains', command: python, args: ['scripts/continuity_chain_check.py', '--strict'] },
  { label: 'Validate behavior contracts', command: python, args: ['scripts/behavior_contract_check.py', '--strict'] },
  { label: 'Validate sequence evals', command: python, args: ['scripts/sequence_eval_check.py', '--strict'] },
  { label: 'Validate generation-run fixtures', command: python, args: ['scripts/generation_run_check.py', '--strict'] },
  { label: 'Lint compiled prompts', command: python, args: ['scripts/prompt_lint.py', '--self-test', '--strict'] },
  { label: 'Check eval harness wiring offline', command: python, args: ['scripts/eval_run.py', '--self-test', '--strict'] },
  { label: 'Check frame extraction wiring offline', command: python, args: ['scripts/extract_last_frame.py', '--self-test', '--strict'] },
  { label: 'Run upstream unit tests', command: python, args: ['-m', 'unittest', 'discover', '-s', 'tests', '-v'] },
  { label: 'Compile upstream Python files', command: python, args: ['-m', 'compileall', 'scripts', 'tests'] },
];

function main(): void {
  if (!fs.existsSync(seedanceRoot) || !fs.statSync(seedanceRoot).isDirectory()) {
    throw new Error(`Seedance Skill OS vendor root not found: ${seedanceRoot}`);
  }

  for (const check of checks) {
    console.log(`\n==> ${check.label}`);
    const result = spawnSync(check.command, check.args, {
      cwd: seedanceRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: 'inherit',
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }
}

main();

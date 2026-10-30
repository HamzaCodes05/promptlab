# PromptLab: prompt versioning and evals

Treat prompts like code. **Version** them, run them against **datasets**, **score** the outputs, and
**compare** runs to catch regressions before they ship. A CLI gates your CI so a bad prompt change
fails the pull request.

![stack](https://img.shields.io/badge/FastAPI-Python_3.12-009688) ![stack](https://img.shields.io/badge/Next.js-14-black) ![stack](https://img.shields.io/badge/Postgres-16-336791) ![stack](https://img.shields.io/badge/CLI-httpx-3776AB) ![ci](https://img.shields.io/badge/CI-GitHub_Actions-2088FF)

## The problem it solves

You tweak a prompt and it "feels better", but you can't tell whether it broke the cases you fixed last
month. PromptLab makes that measurable:

```
$ promptlab run --prompt sentiment --dataset sentiment-set --version 1 --fail-under 0.9
candidate: sentiment v1 on sentiment-set v1 [exact_match, mock-classifier]
  pass rate 0% | avg score 0.00 | avg latency 0 ms
  FAIL case 0: 'The sentiment of this review is positive.'  (output differs from expected)
GATE FAILED:
  - pass rate 0% is below --fail-under 90%

$ promptlab run --prompt sentiment --dataset sentiment-set --version 2 --baseline-version 1
vs baseline v1: 12 improved, 0 regressed, 0 unchanged (pass rate +100%)
GATE PASSED
```

## Features

| | |
|---|---|
| **Immutable prompt versions** | `{{variable}}` templates plus model, temperature and a note. Pushing identical content is a no-op, so it's safe on every CI build. |
| **Versioned datasets** | JSONL cases with `variables`, `expected` and `criteria`. Each push is a snapshot, so old runs stay comparable. |
| **Scorers** | `exact_match`, `contains`, `regex`, `json_valid` (with required keys), `llm_judge` (rubric-based, with a pass threshold). |
| **Run comparison** | Per-case regressions and improvements between any two runs on the same dataset snapshot. |
| **CI gating** | `--fail-under` (minimum pass rate) and `--baseline-version` + `--max-regressions` (no regressions allowed). |
| **Dashboard** | Browse versions, start runs with live progress, inspect failures, compare runs side by side. |
| **Offline mode** | Built-in `mock-classifier` and `mock-judge` models run the whole workflow with no API key. |

## Architecture

```
 CLI / CI ──┐                               ┌──────────────────────────────┐
            ├── x-api-key ──▶  FastAPI ───▶ │ Postgres                     │
 Dashboard ─┘                   │           │ prompts → prompt_versions    │
 (Next.js)                      │           │ datasets → dataset_versions  │
                                ▼           │   → dataset_cases            │
                    background run task     │ runs → run_results           │
                    (asyncio, bounded       └──────────────────────────────┘
                     concurrency)
                         │ render → model call → score → store
                         ▼
                 Anthropic / mock models  (+ judge model for llm_judge)
```

## Design decisions worth reading

- **Versions are immutable; datasets are snapshots.** A run points at an exact `(prompt version, dataset version)`. Editing a dataset creates a new version, so a comparison is never silently invalidated. Comparing runs on different dataset versions is rejected with a `400`.
- **Idempotent pushes.** Pushing the same content as the *latest* version returns the existing version (`unchanged`). Reverting to older text creates a new version, like reverting a git commit.
- **Concurrent pushes are safe.** Version numbers are assigned under a Postgres advisory lock. The demo fires 8 parallel pushes and asserts versions `1..8` with no gaps or duplicates.
- **Regressions are measured per case.** A "regression" is a case that passed in the base run and fails in the candidate, even if the overall pass rate went up. That's what you want to know before shipping.
- **The judge treats model output as data.** The judge prompt wraps the output in tags and tells the judge to ignore instructions inside it, so an output can't talk its way to a higher score. Judge replies are parsed defensively and clamped to `[0, 1]`; invalid JSON scores 0.
- **Failures are data, not crashes.** A template with a missing variable, a provider error, a timeout or a judge failure is recorded on that case (score 0, error shown) and the run still completes.
- **Runs survive restarts honestly.** On startup, any run left `queued` or `running` by a crash is marked `failed` instead of hanging forever.
- **Single-pass templating.** A case value containing `{{other}}` is never re-expanded, so dataset content can't inject variables.

## Run it

```bash
cp .env.example .env              # set API_TOKEN; ANTHROPIC_API_KEY is optional
docker compose up --build
```

Open http://localhost:3000 and sign in with your `API_TOKEN`. Then load the example:

```bash
pip install -e cli
export PROMPTLAB_URL=http://localhost:8000 PROMPTLAB_TOKEN=<your API_TOKEN>
python scripts/demo.py            # pushes the example, runs evals, asserts the results
```

### Use it on your own prompts

```bash
promptlab prompt push my-prompt prompts/my-prompt.txt --model claude-haiku-5-5 --note "tighter output format"
promptlab dataset push my-set evals/my-set.jsonl
promptlab run --prompt my-prompt --dataset my-set --scorer exact_match --fail-under 0.9 --baseline-version 3
```

Dataset format (JSON Lines):

```json
{"variables": {"review": "Great product!"}, "expected": "positive", "criteria": "Label must be positive"}
```

See `examples/ci/prompt-eval.yml` for a ready-to-copy GitHub Actions workflow that gates PRs.

## Scorers

| Scorer | Passes when | Needs |
|---|---|---|
| `exact_match` | output equals `expected` (whitespace/case-normalised) | `expected` |
| `contains` | output contains `expected` | `expected` |
| `regex` | `expected` (a regex) matches the output | `expected` |
| `json_valid` | output parses as JSON (fenced blocks OK) and has `required_keys` | optional `required_keys` |
| `llm_judge` | judge score ≥ `pass_threshold` (default 0.7) | `expected` and/or `criteria`, a judge model |

LLM judges are noisy and can be biased. Use `temperature: 0`, pin the judge model, keep rubrics specific, and prefer deterministic scorers wherever they fit.

## API

All routes except `/health` require the `x-api-key` header.

| Route | Description |
|---|---|
| `POST /prompts/{name}/versions` | Create the prompt if needed and push a version |
| `GET /prompts`, `GET /prompts/{name}` | List prompts / versions |
| `POST /datasets/{name}/versions` | Push a dataset snapshot (`{"cases": [...]}`) |
| `GET /datasets`, `GET /datasets/{name}?version=` | List / read cases |
| `POST /runs` | Start a run (`202`); `GET /runs`, `GET /runs/{id}` for progress and results |
| `GET /compare?base=&candidate=` | Regressions and improvements between two runs |

## Tests

```bash
pytest api/tests cli/tests        # 23 unit tests: templating, scorers, judge, comparison, CLI gating
python scripts/demo.py            # 16 end-to-end checks through the CLI against a real API + Postgres
```

CI runs both, with a Postgres service container for the end-to-end job.

## Limitations and roadmap

- [ ] Auth is a single shared token; add users, projects and per-project tokens
- [ ] Runs execute in-process; move to a worker queue for horizontal scale
- [ ] Add cost tracking per run (token counts are already stored)
- [ ] Multi-turn and tool-use cases; pairwise (A/B) LLM judging
- [ ] Repeat each case N times to measure variance for non-deterministic prompts
- [ ] Import production traces as dataset cases
- [ ] Migrations instead of `CREATE TABLE IF NOT EXISTS`

## License

MIT

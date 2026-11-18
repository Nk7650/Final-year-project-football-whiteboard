# Roadmap to the WIP presentation (Mon 30 Nov 2026) and beyond

**WIP target:** a working board, a real clip tracked and replayed on it, the first accuracy figures, and a plan-versus-actual demo. Anything beyond that is a bonus; anything less is a risk to flag early.

## Plan by day

| Dates | Goal | Done when |
|---|---|---|
| Wed 18 - Fri 20 Nov | Push this repo from my machine. Run the tests locally. Get one open-dataset clip through `tactics.pipeline` and load the result on the board. Email supervisor about ethics and the client. | `tracking.json` from real footage replays on the board; screenshot saved |
| Sat 21 - Sun 22 Nov | Build the annotation helper (click feet in a frame, convert to pitch metres, save ground truth). Annotate 20-30 frames. | `ground_truth.json` exists |
| Mon 23 Nov | Q&A session (check the VLE for the time). Run `tactics.evaluate`; record the first accuracy results in `docs/EVALUATION.md`. | A results row filled in honestly, whatever the numbers |
| Tue 24 - Fri 27 Nov | Fix the biggest tracking error source found. Draw a plan for the clip and run `tactics.compare`. Build slides. Rehearse the demo twice. | Demo runs end to end without edits |
| Sat 28 - Sun 29 Nov | Freeze code and tag `v0.3-wip`. Record a backup demo video. Back up. | Tag pushed; backup video exists |
| **Mon 30 Nov** | **Present** | |

Ethics runs in parallel and does not block this plan: all WIP work uses open data. Submit the application as soon as the supervisor confirms the route (see [ETHICS.md](ETHICS.md)); approval is needed before Christmas and ideally before the WIP.

## Backlog

| Priority | Item | Why | Status |
|---|---|---|---|
| P0 | Run the pipeline on a real open-dataset clip | Everything downstream depends on it; the pipeline is untested on video | To do |
| P0 | Annotation helper and first ground truth | Needed for any accuracy claim (RQ1) | To do |
| P0 | Name the client team and ask permission | Handbook expects an external client; also needed for ethics | To do |
| P1 | Wire held-out landmark error into the evaluator | Calibration quality in metres | To do |
| P1 | Identity-switch metric (needs id-consistent ground truth) | MOTA and IDF1 | To do |
| P1 | Referee and substitute filtering | Skews shape metrics | To do |
| P1 | Link a key moment to a video timestamp on the board | The suggestion card format needs a clip to verify against | To do |
| P2 | Reference benchmarking (percentiles with sample size) | Suggestion layer 2 | Planned |
| P2 | Pressing metrics (nearest-defender distance, PPDA-style) | Should-have in the specification | Planned |
| P2 | Export boards as image or GIF | Should-have | Planned |
| P3 | Pitch control or xT overlay | Could-have | Planned |
| P3 | Split `web/index.html` into modules | Maintainability once it grows | Planned |

## Risks to watch this fortnight

- **The pipeline fails on real footage** (poor detections, wrong calibration). Mitigation: start now, use a clean wide-angle clip first, and report whatever happens honestly. A documented failure analysis is still good LO4 evidence.
- **Ethics approval slips.** Mitigation: open data for the WIP; do not film anyone before approval.
- **Scope creep.** Mitigation: the P0 list above is the whole plan until Monday 30 November.
- **Explaining AI-assisted code in the Q&A.** Mitigation: work through the questions in [WIP_PRESENTATION.md](WIP_PRESENTATION.md) and run each command yourself at least once.

## After the WIP (Semester B)

- Layers 2 to 4 of the suggestion feature, in priority order.
- Expert validation and usability study once ethics is approved.
- Evaluation chapter, draft chapter for 22 Feb, final report and demonstration video for Mon 19 Apr.

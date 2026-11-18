# Project log

A dated record of what was done, decided and learned, so the report's process and reflection sections (Learning Outcomes 1 and 4) can be written from evidence. Earlier entries were recorded after the fact from my working history; dates marked *confirm* should be checked against my own records.

## Key dates (from the module handbook)

| Date | Milestone |
|---|---|
| w/c 12 Oct 2026 | Specification due (Component 1) |
| w/c 9 Nov 2026 | Meeting Two, progress update (formative) |
| **Mon 30 Nov 2026** | **WIP presentation (Component 2, Semester A)** |
| Before Christmas | Ethics approved |
| w/c 1 Feb, 22 Feb, 22 Mar 2027 | Supervisor meetings (22 Feb: draft chapter) |
| **Mon 19 Apr 2027** | **Final hand-in: product, video demonstration and report** |
| w/c 3, 10, 17 May 2027 | Q&A with both supervisors |

## Log

### 7 Oct 2026: choosing the topic (LO1, LO2)
Asked for topic ideas against my skills (R, Arduino, Java, Python) and interests. Considered browser agents, dashboards, a PWA, game netcode, a fighting-game trainer, a collaborative drawing app, a game analytics dashboard and a football tactics board. **Decision:** the tactics board, with video processing as an integral part. **Why:** it matches my interests, shows front-end, data and computer-vision skills together, and has a measurable evaluation.

### 7 Oct 2026: tutor's question on credibility (LO1, LO2)
My tutor asked who sets the standard for suggestions, what makes them credible and what to compare against. **Response:** four anchors (my own plan, published metrics, open reference data, coach validation) and a layered suggestion design that starts with plan-versus-actual. Recorded in [RESEARCH.md](RESEARCH.md).

### 7 Oct 2026: specification drafted (LO1, LO2)
Filled in the Component 1 template: aim, expectations, search terms, bibliography, MoSCoW, an 11-item risk register and the AI log. **Open:** verify every reference; confirm supervisors and timeline dates.

### 29 Oct 2026: handbook review (LO1, LO4) *confirm date*
Found that the product should ideally be for an external client, and that I must evaluate my own performance as well as the product. **Actions:** name a client team (Leeds Beckett or Leeds Central, to confirm); keep this log; include a reflection on LO1 in the final report.

### Late Oct 2026: ethics application started (LO1) *confirm date*
Opened the Worktribe application. Decisions: adults only; use open datasets first; anonymised ids; no face recognition; project dates from about 1 Dec 2026 to 19 Apr 2027. **Open:** project description, consent and information sheets, data management plan, approval.

### 1 Nov 2026: development environment (LO3)
**Problem:** the new Python install manager opened a configuration helper about Windows app execution aliases, and a sign-in prompt crashed. **Diagnosis:** `py --version` gave 3.13.14 and `py -3.12 --version` gave 3.12.3, so Python was already installed and the `py install` error was harmless. **Decision:** use Python 3.12.3 in a virtual environment, since the newest Python versions can lag behind libraries such as PyTorch and YOLO. **Lesson:** check what the installed launcher does before reinstalling.

### 1 Nov 2026: first prototype (LO3)
Built the single-file board (22 draggable players, four formations, keyframes, run arrows, team-shape metrics) and a first video pipeline script.

### 1 Nov 2026: playback bug found and fixed (LO3, LO4)
**Symptom:** Play changed to Pause but nothing moved, and the clock showed a negative time. **Cause:** a negative time step on the first animation frame made the keyframe index -1, which threw an error that stopped the animation silently. **Fix:** clamp the time step and index. **Lesson:** unexpected display values are a clue; guard the edges of a timeline. This class of bug is now covered by a browser test that checks the animation really advances.

### 1 Nov 2026: video loading and colour/side correction (LO3)
Added MP4 loading synchronised with tracking replay, colour pickers, Swap teams and Flip sides, and plan export. MP3 files are rejected with an explanation because audio contains no player positions. Tracking stays in Python so it can be measured and repeated.

### 18 Nov 2026: repository, tests and plan-vs-actual (LO3)
- Moved the work into this repository with a clean structure and a commit history.
- Refactored the pipeline so the maths (homography, team clustering, track assembly) is separate from OpenCV and YOLO and can be unit-tested. Projection is now one vectorised call per frame.
- Wrote the metrics module, the compare CLI (key moments with evidence sentences) and the accuracy evaluator.
- Added the plan overlay and a plan-versus-actual deviation panel to the board. This is the first implemented layer of the suggestion feature and the one with the strongest credibility argument, because the standard is the user's own plan.
- 39 automated tests including headless-browser tests; CI configured.
- Tried to push to GitHub from the Claude session; the account was not linked, so the commits were prepared locally and pushed from my own machine.
- **Honest status:** the pipeline has not yet been run on real footage. The numbers in `data/` are synthetic.

## Decisions register

| Decision | Alternatives | Reason |
|---|---|---|
| Football tactics board with video analysis | Game analytics dashboard, browser-agent projects | Fits interests and skills; measurable evaluation |
| Fixed tactical-camera footage only | Broadcast footage | Broadcast needs camera-motion handling; out of scope |
| Python 3.12 in a virtual environment | Python 3.13 | Library compatibility |
| Tracking in Python, playback in the browser | Detection in the browser | Reproducible evaluation, better accuracy |
| Suggestions as evidence-based pointers, plan-vs-actual first | Claims of a best formation | No ground truth; credibility |
| Homography in numpy | OpenCV only | Testable without OpenCV; supports least squares |
| Metrics defined once, tested in both languages | Independent implementations | Board and reports cannot disagree |

## Problems and solutions (material for the reflection)

1. Python launcher confusion: solved by reading version output and using a virtual environment.
2. Windows Settings sign-in crash: avoided by using the `py` command.
3. Silent animation failure: found from a negative clock value; fixed with clamping and a regression test.
4. Missing client in the specification: found by reading the handbook; to be fixed by naming a team.
5. Untestable pipeline (OpenCV and YOLO mixed with logic): refactored so the logic is pure and tested.

## Next actions

See [ROADMAP.md](ROADMAP.md).

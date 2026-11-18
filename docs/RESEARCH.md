# Research

## Problem statement

Football coaches below the professional level plan shape and pressing on whiteboards and review matches by re-watching footage. Professional analytics platforms use tracking data to answer "what did we actually do compared with what we intended?", but they are expensive and not available to amateur and university teams. This project asks whether a low-cost web tool, fed by fixed-camera footage, can give coaches a credible answer to that question.

## Research questions

- **RQ1 (technical).** How accurately can an off-the-shelf detector and tracker, with a four-point manual calibration, recover player positions on a pitch from a fixed tactical camera?
- **RQ2 (analytical).** To what extent do automatically flagged key moments (sustained departures from the coach's plan) agree with those identified independently by qualified coaches?
- **RQ3 (usability).** Does comparing a planned shape with observed shape help users identify tactical issues more effectively than re-watching video alone?

The objectives, MoSCoW list and risk register are in the submitted specification (Component 1).

## The credibility question: who sets the standard?

A tutor asked: *who is suggesting the standard, what makes it credible, and what do I compare with?* Football has no universal "correct" formation, so the project does not claim one. The standard is built from four anchors, each stated explicitly wherever a suggestion is shown.

1. **The coach's own plan.** The board defines the intended shape and movement. Layer 1 flags are deviations from this, so the standard is the user's, not the tool's.
2. **Published metrics.** Established, peer-reviewed measures (Expected Threat, VAEP, pitch control, PPDA) rather than invented thresholds.
3. **Reference data.** Open professional datasets for context, shown as percentiles with the sample size. Used as context, never as the target.
4. **Domain experts.** Qualified coaches label key moments independently, which gives a measured agreement figure instead of an assertion.

### Layered design of suggestions

| Layer | What it does | Standard | Status |
|---|---|---|---|
| 1. Plan vs actual | Flags sustained deviations of width, depth, back-line height from the plan | The coach's plan | Implemented (`tactics.metrics`, `tactics.compare`, board panel) |
| 2. Reference benchmarking | Places a metric against reference matches as a percentile with n | Open data | Planned |
| 3. Key-moment detection | Surfaces phases where an action-value model changes most | xT or VAEP | Planned (Could have) |
| 4. Formation and player hypotheses | Suggests ideas as testable hypotheses with supporting clips | Evidence shown, never asserted | Planned (Could have) |

Every suggestion is presented as observation, evidence (metric, value, benchmark, sample size), a video timestamp, caveats (such as tracking error) and source. Layer 1 already follows this: `describe()` in `tactics/metrics.py` produces the evidence sentence, for example *"Back line height was on average 5.9 m more than planned between 7.2 s and 11.8 s (peak 6.6 m)."*

Any language-model use is restricted to rewording computed findings into readable text. It never decides what to recommend, because that could not be validated. This is declared in [AI_USE.md](AI_USE.md).

## Methodology

1. **Build** the board, pipeline and analysis in layers, so a working core exists at every stage.
2. **Measure tracking accuracy** on 20-30 hand-annotated frames: precision, recall, position error in metres, team accuracy ([EVALUATION.md](EVALUATION.md)).
3. **Validate flags with experts:** two or three qualified coaches label key moments in short clips independently. Report precision and recall of the tool's flags against theirs, and the coaches' agreement with each other.
4. **Usability study** with 8-10 players or coaches: task-based tests and the System Usability Scale, compared with a whiteboard baseline.
5. **Reflect** on process and outcomes (Learning Outcome 4), using the project log.

## Data sources

| Source | Use | Note |
|---|---|---|
| StatsBomb Open Data | Event data and 360 freeze frames for reference metrics | Free for research; attribution required. Check current terms before publishing |
| Metrica Sports sample data | Real tracking data to test the analysis layer | Check licence |
| SoccerNet (tracking) | Annotated football video to test the pipeline | Requires accepting terms |
| Wyscout public dataset (Pappalardo et al., 2019) | Event data for reference distributions | Check download terms |

Licences change. Record the version and terms of each dataset at the time of use.

## Literature anchors

Verification status of each item is in [SOURCES.md](SOURCES.md). Anything marked unverified there must be checked before it is cited in the report.

- Decroos et al. (2019), VAEP: valuing actions by their effect on scoring and conceding.
- Singh (2018), Expected Threat (blog post, not peer reviewed).
- Spearman (2018), pitch control; Fernandez and Bornn (2018), space occupation. Check each venue.
- Rein and Memmert (2016): big data and tactical analysis in elite football.
- Bewley et al. (2016), SORT; Zhang et al. (2022), ByteTrack: multi-object tracking.
- Redmon et al. (2016), YOLO: real-time detection.
- Hartley and Zisserman (2004): homography and multiple view geometry.
- Bernardin and Stiefelhagen (2008): CLEAR MOT metrics.
- Brooke (1996): System Usability Scale.
- Cioppa et al. (2022): SoccerNet-Tracking.

## Threats to validity

- **Small samples.** Eight to ten usability participants and two or three coaches give indicative, not statistical, evidence. State confidence accordingly.
- **Annotation bias.** One person annotating ground truth is a single point of failure. Where time allows, a second annotator on a subset, with agreement reported.
- **Benchmarks vs amateur play.** Professional distributions may not describe amateur football. Plan-versus-actual comparisons and a team's own baseline are therefore the primary standard.
- **One camera setup.** Results may not transfer to other pitches or camera heights. State the footage conditions.
- **Self-built test data.** The synthetic data in `data/` demonstrates the tools; it says nothing about real accuracy.

# Generative AI use declaration

Maintained as a running record for the specification's AI log, the report, and the academic honesty requirements.

## Tools

Claude (Anthropic), used through claude.ai and a Claude Code session.

## What it was used for

| Area | How it was used |
|---|---|
| Topic selection | Brainstormed project ideas against my skills and interests; I chose the football tactics board and added the video-analysis component |
| Specification | Drafted the Component 1 content (aim, expectations, search terms, MoSCoW, risk register) from our discussion |
| Standards and credibility | Helped structure the answer to my tutor's question (four anchors, layered suggestions) |
| Code | Drafted and refactored the board, pipeline, analysis tools and tests |
| Documentation | Drafted the README and documents in `docs/`, including the project log |
| Ethics | Explained what a student ethics application needs to declare and drafted wording |
| Setup and debugging | Walked through Python setup and diagnosed a playback bug |

Commits that were produced with AI assistance carry a `Co-Authored-By: Claude` trailer in the commit message, so the history shows which work was AI-assisted.

## What I must do myself (and have not delegated)

- **Verify every reference.** The bibliography was written from the model's memory, apart from the StatsBomb terms, which were checked online. Authors, years, pages and URLs must be checked against the originals before submission.
- **Run and test on real footage.** AI-generated code has been unit tested but the pipeline has not yet been validated on real video. I am responsible for the results I report.
- **Understand every part.** I need to be able to explain the code, the maths (homography, the metric definitions) and the design decisions in the Q&A with both supervisors. See the questions list in [WIP_PRESENTATION.md](WIP_PRESENTATION.md).
- **Confirm facts about the module, the ethics process and dataset licences** with the module leader, supervisor and original sources.

## Verification practice

- Claims in documents were checked against the code or tests where possible (for example, the metric numbers in the README are asserted by tests).
- Evaluation results are only entered after the experiment has been run, never drafted in advance.
- Where AI suggested a design, the decision and the reason are recorded in [ARCHITECTURE.md](ARCHITECTURE.md) and the project log.

## Product use of AI models

The product uses pretrained computer-vision models (YOLO, ByteTrack) for detection and tracking. It does not use a language model. If one is added later, it will only reword computed findings into readable text and will be declared here.

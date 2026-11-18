# Ethics and data handling

**Status (update this line whenever it changes):** Worktribe ethics application started; not yet approved at the time of writing. **No footage of real people is to be collected or processed until approval is in place.** Until then all development and testing uses synthetic data (`data/`) or open datasets used within their licences.

## What the project involves

| Activity | People involved | Rule |
|---|---|---|
| Development and testing on open datasets | Real players appear in the data, but it is published for research | Follow each licence, credit the provider, record the dataset version |
| Filming a team (training or friendly) | Players, possibly opponents and officials | Adults only, informed consent, club permission, anonymised track ids, no face recognition |
| Expert validation | 2-3 qualified coaches or analysts | Participant information sheet, consent, right to withdraw |
| Usability testing | 8-10 players or coaches | Same, plus anonymous questionnaire data |

## Rules for this repository

The repository is public, so it must **never** contain:

- video or images of identifiable people, or model weights (the `.gitignore` blocks `*.mp4`, `*.mov`, `*.pt` and local `tracking.json`);
- consent forms, signed documents or participant details;
- names, contact details or questionnaire responses linked to a person;
- anything the ethics approval does not cover.

Aggregate, anonymised results (for example mean SUS) may be committed once the supervisor agrees.

## Data management (proposed, confirm against the approved application)

- **Storage:** footage on an encrypted university or personal drive, outside the repository, with access limited to the student and supervisors.
- **Anonymisation:** tracking uses numeric ids only; no names, shirt numbers or faces are stored.
- **Retention:** delete raw footage after assessment unless the approval says otherwise.
- **Withdrawal:** a participant can withdraw before analysis; their data is removed.
- **Legal basis:** UK GDPR and the Data Protection Act 2018 for any personal data.

## Open questions for the supervisor

- Which approval route applies (full or light touch)?
- Does using public open datasets need declaring, and in what form?
- Is a letter of permission from the club required, and which club (Leeds Beckett or Leeds Central)?
- Should the client count as a participant?
- Are there university rules on retention periods?

## Approval record (fill in)

| Item | Value |
|---|---|
| Application reference | |
| Date submitted | |
| Date approved | |
| Conditions | |

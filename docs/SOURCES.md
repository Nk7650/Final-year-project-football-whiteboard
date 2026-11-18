# Sources and verification status

Every external claim in this repository is listed here with a link and a status. **Verified** means I opened the source or a bibliographic record (publisher, conference or index page) on 18 Nov 2026 and the title, authors and year matched. **Unverified** means it could not be opened from my tools; check it yourself before citing in the report. Nothing marked unverified should be cited as fact.

| Source | Used for | Status | Link |
|---|---|---|---|
| Giancola et al. (2018), SoccerNet: A Scalable Dataset for Action Spotting in Soccer Videos, CVPR Workshops | Dataset context | Verified (CVF open access record). Page numbers not re-checked: confirm on the CVF page | https://openaccess.thecvf.com/content_cvpr_2018_workshops/w34/html/Giancola_SoccerNet_A_Scalable_CVPR_2018_paper.html |
| Singh (2018), Expected Threat (blog) | xT concept | Verified: author Karun Singh, 2018, personal blog. **Not peer reviewed**, and the year is 2018, not 2019 | https://karun.in/blog/expected-threat.html |
| Decroos et al. (2019), VAEP | Action values | Verified earlier in this session | |
| Rein and Memmert (2016) | Big data in football | Verified earlier in this session | |
| Pappalardo et al. (2019), Wyscout dataset | Reference data | Verified earlier in this session | |
| Cioppa et al. (2022), SoccerNet-Tracking | Tracking benchmark | Verified earlier; pages and full author list still to copy from the publisher | |
| Bewley et al. (2016), SORT | Tracking | Verified earlier | |
| Redmon et al. (2016), YOLO | Detection | Verified earlier | |
| Bernardin and Stiefelhagen (2008), CLEAR MOT | Tracking metrics | Verified earlier | |
| Zhang et al. (2022), ByteTrack, ECCV | Tracker | DOI only. Book volume and pages **unverified**: do not cite page numbers | doi 10.1007/978-3-031-20047-2_1 (Springer page was not reachable) |
| Fernandez and Bornn (2018) "Wide Open Spaces" and Spearman (2018) "Beyond Expected Goals" | Pitch control | Partially confirmed. Cite each for its own work: Spearman for pitch control in the Sloan paper, Fernandez and Bornn for space occupation/valuation. Check venues yourself | |
| Brooke (1996), SUS | Usability scale | Scoring method confirmed; page range **unverified** | |
| SUS average of about 68 | Context in EVALUATION.md | Secondary sources only | |
| Hartley and Zisserman (2004) | Homography | Textbook, **unverified** here: check edition and publisher | |
| Ultralytics YOLO licence | Pipeline dependency | AGPL-3.0 with an enterprise licence option, per ultralytics.com/license. Fine for coursework; matters if the product is distributed | https://ultralytics.com/license |
| StatsBomb open data | Reference data | Repository exists; **terms (attribution) must be read in its README/licence before use** | https://github.com/statsbomb/open-data |
| Metrica Sports sample data | Tracking test data | Repository exists; **licence unverified**, read it before use | https://github.com/metrica-sports/sample-data |
| SoccerNet data | Test video | Access requires accepting terms (via the SoccerNet SDK); **terms unverified** | https://pypi.org/project/SoccerNet |

## Claims that are my own, not sourced

- The four standards (plan, published metrics, reference data, experts) are my design, not taken from a paper.
- Width, depth and back-line height definitions are mine and are tested in `tests/`; they are not standard published metrics.
- "Deepest player is the goalkeeper" is a stated simplification.

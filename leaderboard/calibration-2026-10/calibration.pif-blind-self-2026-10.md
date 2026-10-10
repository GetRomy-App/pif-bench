# Judge calibration

Every task ships a **reference** deliverable that must pass every criterion and a **flawed** one with planted errors that must fail exactly the criteria listed in `fixtures/expected.json`. A judge's accuracy is the share of those verdicts it gets right. A *false pass* — passing a planted error — is the costly direction.

| Judge | Verdicts | Accuracy | False passes | False fails | Errors |
|---|---|---|---|---|---|
| opus-5.5-blind | 662 | **100.0%** | 0 | 0 | 0 |


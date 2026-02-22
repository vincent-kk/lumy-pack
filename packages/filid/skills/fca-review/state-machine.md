# State Machine — Deliberation Rules

The chairperson executes this state machine during Phase C to drive
multi-persona political consensus. Maximum **5 rounds** before forced conclusion.

## State Transition Diagram

```
PROPOSAL → DEBATE → VETO / SYNTHESIS / ABSTAIN → CONCLUSION
                ↑                    │
                └────────────────────┘  (VETO with compromise → re-DEBATE)
```

## Transition Rules

| Current   | Condition                                                     | Next                 | Description                                             |
| --------- | ------------------------------------------------------------- | -------------------- | ------------------------------------------------------- |
| PROPOSAL  | Chairperson tables the code                                   | DEBATE               | Personas begin opinions based on verification results   |
| DEBATE    | Critical flaw found (FCA-AI rule violation, hardcoded secret) | VETO                 | Operations/Knowledge Manager exercises absolute veto    |
| DEBATE    | Consensus reached (Pareto-optimal compromise)                 | SYNTHESIS            | Chairperson synthesizes compromise into final agreement |
| DEBATE    | Persona confidence below threshold                            | ABSTAIN              | Persona declares abstention                             |
| VETO      | Proposer submits amended code                                 | PROPOSAL             | New round with modified code                            |
| VETO      | Business Driver offers CoD-based compromise                   | DEBATE               | Re-enter debate under compromise conditions             |
| VETO      | Irreconcilable                                                | CONCLUSION           | Review ends as FAIL                                     |
| SYNTHESIS | —                                                             | CONCLUSION           | Agreement finalized, output review report               |
| ABSTAIN   | Quorum check (see below)                                      | CONCLUSION or DEBATE | Depends on quorum rules                                 |

## Quorum Rules

Handle mixed results (some SYNTHESIS + some ABSTAIN):

| Situation                                 | Verdict                                  | Notes                                    |
| ----------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| >= 2/3 of elected members reach SYNTHESIS | CONCLUSION (APPROVED or REQUEST_CHANGES) | Abstainers excluded from denominator     |
| Any VETO present (>= 1)                   | VETO (attempt business compromise)       | Single VETO overrides SYNTHESIS          |
| SYNTHESIS < 2/3, no VETO                  | CONCLUSION (INCONCLUSIVE)                | Consensus not reached, escalate to human |

**Quorum examples**:

- 4 members: 3 SYNTHESIS + 1 ABSTAIN → effective 3/3 = 100% >= 2/3 → **CONCLUSION**
- 6 members: 3 SYNTHESIS + 2 ABSTAIN + 1 VETO → VETO present → **VETO**
- 4 members: 1 SYNTHESIS + 3 ABSTAIN → effective 1/1 = 100% >= 2/3 → **CONCLUSION** (add majority-abstain warning)

## Final Verdict Mapping

| State Machine Outcome                 | ReviewVerdict   |
| ------------------------------------- | --------------- |
| SYNTHESIS with no remaining fix items | APPROVED        |
| SYNTHESIS with fix items              | REQUEST_CHANGES |
| Irreconcilable VETO                   | REQUEST_CHANGES |
| Quorum not met / 5-round limit        | INCONCLUSIVE    |

## Round Limit

- Maximum rounds: **5**
- If consensus not reached within 5 rounds: CONCLUSION (INCONCLUSIVE)
- Reason: Prevent infinite loops + conserve LLM context

## Deliberation Log Format

Record each round in `review-report.md`:

```markdown
### Round N — <STATE>

- **State**: <PROPOSAL|DEBATE|VETO|SYNTHESIS|ABSTAIN>
- **<Persona>**: "<opinion or action>"
- **Chairperson mediation**: "<compromise attempt if applicable>"
- **Transition**: <CURRENT> → <NEXT>
```

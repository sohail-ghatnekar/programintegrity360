<!-- discovery-metadata: cs=0 xaml=1 deps=1 -->
# PI360EvidenceSnapshotAutomation - Project Context

## Overview

| Property | Value |
|----------|-------|
| Name | PI360EvidenceSnapshotAutomation |
| Type | Process |
| Description | Builds a deterministic Program Integrity evidence-completeness snapshot for case routing. |
| Target Framework | Portable |
| Expression Language | VisualBasic |

## Dependencies

| Package | Version | Category |
|---------|---------|----------|
| UiPath.System.Activities | 26.6.2 | Core |

## Project Structure

```text
PI360EvidenceSnapshotAutomation/
|-- Main.xaml
|-- project.json
`-- project.uiproj
```

## Entry Point

`Main.xaml` is a Sequence that checks five evidence-source flags and returns readiness, missing-evidence CSV, and a summary.

## Conventions

- Arguments use `in_` and `out_` prefixes.
- The workflow uses built-in cross-platform activities only.
- Logging uses `Log Message` at Info level.

## Quick Reference

- Validate: `uip rpa validate --file-path Main.xaml --project-dir . --output json`
- Build: `uip rpa build . --output json`

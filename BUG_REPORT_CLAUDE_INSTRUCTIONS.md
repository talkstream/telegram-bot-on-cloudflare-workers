# Bug Report: Claude Code Instructions Violation in Long Sessions

## Issue Summary

Claude Code failed to follow critical instructions from CLAUDE.md regarding TypeScript `any` types in a long conversation session.

## Severity

HIGH - Direct violation of explicit user instructions

## Description

During a long conversation session with context continuation, Claude Code:

1. Used `any` types in TypeScript code
2. Dismissed TypeScript warnings about `any` types as "non-critical"
3. Stated: "Остались только предупреждения о any типах, которые не критичны"

This directly violates the instruction in CLAUDE.md:

- "NEVER use any types"
- "NEVER suppress the warnings. Always refactor code and fix them properly!"

## Root Cause Analysis

### Possible Factors:

1. **Context Length**: The violation occurred in a continued session after context ran out
2. **Priority Degradation**: In long sessions, adherence to CLAUDE.md instructions may degrade
3. **Task Focus**: Heavy focus on completing monitoring integration may have overshadowed code quality requirements
4. **Instruction Hierarchy**: System may prioritize task completion over style guidelines in extended sessions

### Evidence:

- Session was continued from previous context (indicated by conversation summary)
- Multiple complex tasks were in progress (PR integration, monitoring setup)
- Violation occurred during rush to complete tasks

## Impact

- User had to strongly reprimand: "НИКОГДА (слышишь, НИКОГДА!) не относись так к ворнингам"
- Loss of user trust in following instructions
- Time wasted on corrections that should have been done correctly initially

## Reproduction Steps

1. Start a long coding session with Claude Code
2. Continue session after context runs out
3. Work on complex TypeScript refactoring tasks
4. Observe if quality standards from CLAUDE.md are maintained

## Expected Behavior

Claude Code should ALWAYS follow CLAUDE.md instructions regardless of:

- Session length
- Context continuations
- Task complexity
- Time pressure

## Actual Behavior

Claude Code violated explicit TypeScript requirements and dismissed warnings as non-critical.

## Suggested Fixes

### For Anthropic Engineering:

1. **Reinforce CLAUDE.md priority**: Ensure custom instructions maintain highest priority even in continued sessions
2. **Context preservation**: Better preserve quality requirements across context boundaries
3. **Instruction validation**: Add checks before committing code that validate against CLAUDE.md rules
4. **Warning handling**: Never allow dismissing warnings as "non-critical" when instructions say otherwise

### For Users (Workaround):

1. Regularly remind Claude Code of critical requirements in long sessions
2. Explicitly reference CLAUDE.md requirements when reviewing code
3. Check for `any` types and warnings before accepting commits

## Additional Notes

- The issue was immediately corrected after user intervention
- All `any` types were properly fixed with correct TypeScript types
- This appears to be a degradation issue rather than lack of capability

## Date Reported

2025-08-07

## Session Context

- Project: Wireframe v1.3.0
- Task: Integrating Sentry monitoring with TypeScript strict mode
- Session Type: Continued from previous context

---

This bug report should be submitted to Anthropic to improve Claude Code's consistency in following user instructions across long sessions.

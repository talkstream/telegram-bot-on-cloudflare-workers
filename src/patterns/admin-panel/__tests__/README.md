# Admin Panel Tests

## Current Status

These tests are currently failing because they were written specifically for the Kogotochki project
and contain hardcoded Russian localization strings and project-specific expectations.

## TODO

- [ ] Make all tests universal and platform-agnostic
- [ ] Remove Kogotochki-specific strings
- [ ] Update expectations to match the generic admin panel implementation
- [ ] Ensure tests work for any Wireframe-based project

## Temporary Solution

Until these tests are refactored, they are causing CI/CD failures. The tests need to be updated
to be generic and work with the universal admin panel pattern.

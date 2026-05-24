# Git Hooks

This repository uses `core.hooksPath=.githooks`.

- `pre-push`: blocks pushes that contain likely secrets (`.env` files, private keys, cloud/API token patterns, and suspicious hardcoded credential assignments).

To enable on a fresh clone:

```bash
git config core.hooksPath .githooks
```

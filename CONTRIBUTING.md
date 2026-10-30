# Contributing

## Frontend workflow (Satyam)

1. Clone and switch to your branch:
   ```bash
   git clone <repo-url>
   cd property-desk
   git checkout satyam-frontend
   ```
2. Put all frontend code inside `frontend/`.
3. Fill in `docs/FRONTEND.md` (see the checklist there) so the rest of the
   team knows what is done and what is left.
4. Commit and push:
   ```bash
   git add .
   git commit -m "feat(frontend): <what you did>"
   git push origin satyam-frontend
   ```
5. When a feature is ready, open a Pull Request from `satyam-frontend` into `main`.

## After the frontend handoff

The team reviews `docs/FRONTEND.md`, then builds the remaining parts
(backend APIs, integration, deployment) on separate branches.

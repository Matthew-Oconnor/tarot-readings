# Tarot Readings

Make sure your environment has npm and Node.js before doing any work so that your app can run!

If you are missing any npm dependencies, run `npm install` inside `backend/` and `frontend/`. There are two `package.json` files because the API server and Vite app are installed separately.

## Backend LLM Configuration

The backend routes tarot prompts through the current Apex-01 / Simphoni language service flow. Configure the API base and model with environment variables; do not commit credentials or local `.env` files.

For local development from the repository root:

```sh
cp .env.example .env
node backend/server.js
```

Required:

- `SIMPHONI_API_BASE_URL`: Apex-01 / Simphoni API base URL. Use the same-origin edge, Orkest API, Simphoni core API, or another configured service base that exposes compatible language routes.
- `SIMPHONI_MODEL`: Model name passed to the upstream service.

Optional:

- `SIMPHONI_TIMEOUT_MS`: upstream request timeout, default `120000`.
- `SIMPHONI_STREAMING_ENABLED`: defaults to `true`; sends `stream: true` upstream and streams text to `/stream` callers.
- `SIMPHONI_NON_STREAMING_FALLBACK`: defaults to `true`; retries with `stream: false` if streaming routes are unavailable.
- `SIMPHONI_FALLBACK_BASE_URLS`: comma-separated fallback base URLs tried after the primary base.
- `SIMPHONI_INCLUDE_LOCAL_FALLBACKS`: enables built-in Apex-01 local fallbacks. When no base URL is configured, local development falls back to `127.0.0.1:5037`, `127.0.0.1:8768`, and `127.0.0.1:11435`.
- `SIMPHONI_API_KEY` or `SIMPHONI_API_TOKEN`: optional bearer credential for deployments that require one.

Legacy env names `CURRENT_MODEL`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, and `OLLAMA_BASE_URL` are still accepted as compatibility fallbacks, but new deployments should use the `SIMPHONI_*` names.

The backend tries compatible endpoints in this order for chat-style tarot prompts:

1. `/api/chat`
2. `/v1/chat/completions`
3. `/api/generate`

For prompt-style calls it tries `/api/generate`, `/v1/completions`, then `/api/chat`. Streaming responses may be newline-delimited JSON or SSE `data:` events and may end with `[DONE]`. Malformed stream lines are ignored and counted in response metadata instead of crashing the request.

`GET /healthz` reports provider, model/base URL presence, timeout, streaming settings, and redacted base URLs. It never reports API keys or tokens.

If you're running as a container, pass runtime configuration with `--env-file .env` or Kubernetes environment variables. The Kubernetes manifests keep the current image tags and host values while using `SIMPHONI_API_BASE_URL`, `SIMPHONI_MODEL`, `SIMPHONI_TIMEOUT_MS`, and `SIMPHONI_STREAMING_ENABLED`.

# Container Builds

Use [`scripts/buildx-images.sh`](/mnt/storage1/Projects_With_Jon/tarot-readings/scripts/buildx-images.sh) to build Raspberry Pi images with `docker buildx`.

Common examples:

- Build and push both images for 64-bit Pis:
  `./scripts/buildx-images.sh --tag v1.0.3 --push`
- Build and push both images for 64-bit and 32-bit Pis:
  `./scripts/buildx-images.sh --tag v1.0.3 --platform linux/arm64,linux/arm/v7 --push`
- Build only the frontend image:
  `./scripts/buildx-images.sh --tag v1.0.3 --target frontend --push`
- Build only the backend image and load it into local Docker:
  `./scripts/buildx-images.sh --tag dev-pi --target backend --load`

Defaults:

- Registry namespace: `zaptapped`
- Frontend image: `zaptapped/tarot-frontend`
- Backend image: `zaptapped/my-first-container`
- Default platform: `linux/arm64`

# Frontend Development

The frontend now uses Vite instead of Create React App.

## Available Scripts

Run these from `frontend/`:

### `npm start` or `npm run dev`

Starts the Vite dev server on [http://localhost:3000](http://localhost:3000).\
The dev server proxies `/api` requests to the backend on port `5001`.

### `npm test`

Runs the frontend tests with Vitest.

### `npm run build`

Builds the app for production into the `dist` folder.

### `npm run preview`

Serves the production build locally for a quick smoke test.

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.

# Legacy Notes

The older Create React App instructions below no longer apply and are kept only as historical context while the rest of the README is refreshed.


TODO: Consider accessibility options for the app and implement.
TODO: Add card flip feature
TODO: Add mildly animated background for aesthetics.

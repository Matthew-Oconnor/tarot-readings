# Helpful tips to set your environment

Make sure your environment has npm and Node.js before doing any work so that your app can run!

If you are missing any npm dependencies, you can run `npm install` from the root project directory. There are two `package.json` files that contain the dependencies.

There is a backend script that is required to make API requests on your behalf. 
This backend server will make calls to OpenAI, so you will need to create a `.env` file and provide your OpenAI API key.
You can create this file by running the following command from the root project directory with your API key.

`echo OPENAI_API_KEY=<your-api-key-here> > .env`

Start the backend server from the root project directory.

`node backend/server.js`

If you're running as a container, you'll need to use the `--env-file .env` option in order to provide the API key to the container.

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

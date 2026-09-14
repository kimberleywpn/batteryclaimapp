# GitHub Pages Deployment

The GitHub repository contains the React frontend only. Never commit the backend
`.env`, SQLite data, backups, or database credentials.

## Required addresses

- Frontend: `https://OWNER.github.io/REPOSITORY/`
- Backend: a public HTTPS origin that forwards to `http://127.0.0.1:8080`

## GitHub settings

1. Create a repository and push this folder to its `main` branch.
2. In **Settings > Secrets and variables > Actions > Variables**, add
   `PUBLIC_API_URL` with the backend HTTPS origin and no trailing slash.
3. In **Settings > Pages**, choose **GitHub Actions** as the source.
4. Run **Deploy Frontend To GitHub Pages**, or push to `main`.

## Backend settings

Add these values to `backend/.env`, without trailing slashes:

```env
APP_ORIGIN=https://claims-api.example.com
FRONTEND_ORIGIN=https://OWNER.github.io
```

`FRONTEND_ORIGIN` is an origin, so it does not include the repository path.
Restart the backend after changing `.env`. The public HTTPS reverse proxy must
forward the original host to `127.0.0.1:8080`.


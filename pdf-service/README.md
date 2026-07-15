# Professional PDF service

This Cloud Run service renders professional project and Overview reports in memory and returns them as download attachments. It does not create Cloud Storage objects, Firestore report records, or persistent PDF files.

## Production boundary

- Browser: sends only report selections and a Firebase ID token.
- Cloud Run: accepts `POST` only after an exact-origin CORS check and Firebase token verification.
- Firestore: report data is read server-side under the `pm-dashboard-pdf` runtime service account, which has `roles/datastore.viewer` only.
- Browser: receives a Blob download and immediately revokes its object URL.

The Cloud Run service uses public ingress so an authenticated GitHub Pages browser can reach it. Public ingress does not grant report access: every report endpoint verifies the Firebase ID token and Dashboard role before it reads report data.

## Current v2.1 deployment

- Service: `pm-dashboard-pdf`
- Region: `asia-southeast1`
- Allowed browser origin: `https://augusliang23-web.github.io`
- Public service URL is defined in `../professional-pdf-config.js`; it is an endpoint, not a secret.

Deploy updates with:

```powershell
./deploy.ps1
```

The deployer needs permission to deploy Cloud Run and update service IAM. The runtime account must already exist with the configured name and Firestore viewer role.

## Company GitHub migration

Moving only the source code to a company GitHub repository is supported. The existing Cloud Run service and Firebase project continue to work as long as:

1. `professional-pdf-config.js` keeps the current service URL.
2. If the new GitHub Pages hostname changes, update Cloud Run `ALLOWED_ORIGIN` to the new origin (scheme + host only; no repository path), then redeploy or update the service environment variable.
3. Keep the Firebase project configuration and authorized sign-in domain aligned with the new site.

No credentials, service-account keys, or generated PDFs are stored in this repository.

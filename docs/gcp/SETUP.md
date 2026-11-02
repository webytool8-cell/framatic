# Turning on MP4 export (Google Cloud Run)

Each export runs as one **Cloud Run Job** execution: a container (built from [`renderer/Dockerfile`](../../renderer/Dockerfile)) renders the video with Remotion, uploads the MP4 to your Supabase Storage bucket `renders`, and reports progress straight to the database. Nothing runs (or costs anything) between exports.

Use one region throughout. The default is **`us-central1`**.

## 1. Project and APIs
In your Google Cloud project, enable **Cloud Run Admin API**, **Cloud Build API** and **Artifact Registry API** (the deploy action also tries to enable them).

## 2. Two service accounts
**IAM & Admin → Service Accounts → Create service account**

| Account | Used by | Roles |
| --- | --- | --- |
| `framatic-deployer` | GitHub Actions (builds & deploys) | Cloud Run Admin, Cloud Build Editor, Artifact Registry Administrator, Service Account User, Storage Admin, Service Usage Consumer |
| `framatic-app` | The website on Vercel (starts exports) | Cloud Run Developer |

For each, open it → **Keys → Add key → Create new key → JSON** and download the file.

> The job itself runs as the project's default compute service account; it only talks to Supabase, so it needs no extra roles.

## 3. GitHub secrets
Repo → **Settings → Secrets and variables → Actions**

- `GCP_PROJECT_ID`: your project ID
- `GCP_DEPLOY_KEY`: the whole contents of the `framatic-deployer` JSON key
- `SUPABASE_URL`: same as `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`: same as in Vercel
- *(optional, Variables tab)* `GCP_REGION` if you don't use us-central1

Then **Actions → Deploy video renderer → Run workflow**. The first build takes about 5–8 minutes; later ones are faster. It re-runs on its own when the video code changes.

## 4. Vercel environment variables
- `GCP_PROJECT_ID`
- `GCP_REGION`: e.g. `us-central1`
- `GCP_SERVICE_ACCOUNT_KEY`: the whole contents of the `framatic-app` JSON key (or its base64)

Then **Redeploy**.

## 5. Database
Supabase → **SQL Editor** → run [`supabase/migrations/20261102000000_renders.sql`](../../supabase/migrations/20261102000000_renders.sql). It adds the `renders` table and the private `renders` storage bucket.

## 6. Try it
Open a concept → **Export MP4**. A 15–30 second ad usually takes about a minute.

### Costs
You pay Cloud Run job time (4 vCPU / 8 GiB) only while a video renders (roughly a minute per ad), plus Cloud Build minutes when the renderer is redeployed. Supabase Storage holds the MP4s.

### Troubleshooting
- *"render job wasn't found"*: run the GitHub action, and check `GCP_REGION` matches.
- *"can't start the render job"*: give `framatic-app` the **Cloud Run Developer** role.
- *"rejected the service-account key"*: re-paste the JSON into `GCP_SERVICE_ACCOUNT_KEY` and redeploy.
- Render failed: **Cloud Run → Jobs → framatic-renderer → Executions** shows the logs.

### Hardening (optional)
The deploy passes the Supabase service-role key to the job as an environment variable, which project members can see in the console. To keep it in **Secret Manager** instead, create a secret and replace `--set-env-vars` for it with `--set-secrets=SUPABASE_SERVICE_ROLE_KEY=<secret>:latest` in the workflow.

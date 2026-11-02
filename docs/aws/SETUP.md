# Turning on MP4 export (AWS + Remotion Lambda)

Framatic renders videos with [Remotion Lambda](https://www.remotion.dev/docs/lambda) in your own AWS account. A typical 15–30 second ad costs a few cents to render. Setup takes about 15 minutes and is all done in web dashboards.

## 1. AWS account
Create or sign in to an account at aws.amazon.com. Use the region **US East (N. Virginia) – us-east-1** unless you have a reason to pick another (then use that region everywhere below).

## 2. Create the role the renderer runs as
1. Open **IAM → Roles → Create role**.
2. Trusted entity: **AWS service**, use case **Lambda** → Next → Next (skip permissions).
3. Role name: **`remotion-lambda-role`** (exactly this) → Create role.
4. Open the new role → **Add permissions → Create inline policy → JSON**.
5. Paste the contents of [`remotion-role-policy.json`](./remotion-role-policy.json) → Next → name it `remotion-lambda-policy` → Create policy.

## 3. Create the user Framatic signs in as
1. **IAM → Users → Create user**, name `framatic-remotion`, no console access → Next → Create user.
2. Open the user → **Add permissions → Create inline policy → JSON**.
3. Paste the contents of [`remotion-user-policy.json`](./remotion-user-policy.json) → Next → name it `remotion-user-policy` → Create policy.
4. Open the user's **Security credentials** tab → **Create access key** → "Application running outside AWS" → Create.
5. Copy the **Access key ID** and **Secret access key** (the secret is only shown once).

## 4. Add the keys to GitHub and deploy the renderer
1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `REMOTION_AWS_ACCESS_KEY_ID`
   - `REMOTION_AWS_SECRET_ACCESS_KEY`
   - (only if not us-east-1) **Variables** tab → `REMOTION_AWS_REGION`
2. **Actions → Deploy video renderer → Run workflow**. Wait for the green check (2–4 minutes).
   It re-runs automatically whenever the video code changes.

## 5. Add the keys to Vercel
Project → **Settings → Environment Variables**:
- `REMOTION_AWS_ACCESS_KEY_ID`
- `REMOTION_AWS_SECRET_ACCESS_KEY`
- `REMOTION_AWS_REGION` = `us-east-1`

Then **Deployments → Redeploy**.

## 6. Update the database
Supabase → **SQL Editor** → paste and run [`supabase/migrations/20261102000000_renders.sql`](../../supabase/migrations/20261102000000_renders.sql).

## 7. Try it
Open any concept → **Export MP4**. The file downloads when it's ready.

### Troubleshooting
- *"The video renderer isn't deployed yet"*: run the GitHub action (step 4) in the same region as `REMOTION_AWS_REGION`.
- *"AWS rejected the access keys"*: re-copy the keys into Vercel, then redeploy.
- *"doesn't have the Remotion permissions"*: the user policy from step 3 is missing.
- New AWS accounts have low Lambda limits; if renders queue, request a higher "Concurrent executions" quota in **Service Quotas → AWS Lambda**.

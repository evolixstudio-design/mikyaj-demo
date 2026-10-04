# Google sign-in for Mikyaj

Google sign-in is proposed, not connected yet. Email/password and cash-on-delivery checkout continue to work. Create credentials in the shop owner's Google Cloud project, not a developer's unrelated project.

## Production setup

1. Create/select a Google Cloud project, then open **Google Auth Platform**.
2. In **Branding**, set Mikyaj, the real logo, an actively monitored support email and developer contact email. Home: `https://mikyajkw.com/`; privacy: `https://mikyajkw.com/privacy.html?lang=en`; terms: `https://mikyajkw.com/terms.html?lang=en`. Add `mikyajkw.com` as an authorized domain.
3. Verify the domain in **Google Search Console** using the domain property's DNS TXT record. The verifying Google account should be an Owner or Editor of the Cloud project. This requires access to the domain's DNS provider.
4. In **Audience**, select External and use **Publish app** for the real customer-facing app. Basic Google sign-in needs only `openid`, `email`, and `profile`; do not request Gmail, Drive, Contacts or other permissions.
5. In **Clients**, create a **Web application** client. For the proposed Google Identity Services popup flow add `https://mikyajkw.com` under authorized JavaScript origins (no trailing path). Add `https://www.mikyajkw.com` only if it is actually served. Use a separate development client for `http://localhost:3101` and `http://127.0.0.1:3101`. A JavaScript callback flow does not need an invented redirect URI; if implementing a redirect flow later, register its exact implemented endpoint.
6. Use **Verify Branding** / the verification center when requested so the consent screen can display Mikyaj's verified name/logo. Ensure the public privacy policy explains the Google name, email and account identifier used to create/sign in to a customer account, retention/deletion and any sharing. A branding approval is separate from sensitive-scope approval.

## The 100-user distinction

The 100-test-user rule and the unverified sensitive-scope user cap are different. Google's current Audience documentation explicitly exempts requests limited to name/email/profile, including Sign in with Google, from the testing allowlist, warning and seven-day authorization behavior. Sensitive or restricted scopes introduce additional verification and cap rules. Normal website visitors are never limited to 100 by OAuth; these rules concern Google authorization. Production status and branding still need correct setup; approval cannot be guaranteed in advance.

## Application implementation

- Render Google's official Identity Services button on the account page only when a public client ID is configured. A Google client secret must never appear in frontend code.
- Send the returned ID token with an anti-CSRF nonce to a same-origin JSON endpoint. Verify signature, audience, issuer, expiry, nonce and `email_verified` on the server using Google's supported verifier.
- Identify the account by the stable Google `sub` identifier. Do not silently attach Google to an existing password account just because the emails match; ask that customer to sign in and explicitly link accounts.
- Issue the existing Mikyaj HttpOnly customer session after verification. No Gmail/Drive tokens or offline refresh access are required. Keep administrator sign-in separate.
- Add a Google identity table with a unique provider subject. Use a nullable password only for Google-only accounts and guard the password-login flow. Provide account-link/unlink and account deletion controls.
- Test invalid/expired/replayed tokens, wrong audience, linking conflicts, disabled accounts, logout and the mobile popup/redirect behavior before enabling it in production.

## Official references (checked 2026-10-04)

- [Manage app audience and the basic sign-in exception](https://support.google.com/cloud/answer/15549945?hl=en)
- [Brand verification and domain/privacy requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [Google Identity Services overview](https://developers.google.com/identity/gsi/web/guides/overview)
- [Verify Google ID tokens on the server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

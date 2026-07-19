#!/usr/bin/env node
/**
 * Applies Tavola-branded auth email templates and Resend SMTP config
 * to the hosted Supabase project via the Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx \
 *   SUPABASE_PROJECT_REF=abcdefghijklmnop \
 *   RESEND_API_KEY=re_xxx \
 *   node scripts/apply-email-templates.mjs
 *
 * Optional:
 *   DRY_RUN=1  — prints the payload without making the API call
 */

// ── Config ────────────────────────────────────────────────────────────────────

const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF   = process.env.SUPABASE_PROJECT_REF;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DRY_RUN       = process.env.DRY_RUN === '1';

if (!ACCESS_TOKEN)  fatal('SUPABASE_ACCESS_TOKEN is required. Generate one at https://supabase.com/dashboard/account/tokens');
if (!PROJECT_REF)   fatal('SUPABASE_PROJECT_REF is required. Find it in your Supabase project settings (Settings → General).');
if (!RESEND_API_KEY) fatal('RESEND_API_KEY is required.');

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildEmail({ heading, body, ctaLabel, ctaUrl, note }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${heading} | Tavola</title>
</head>
<body style="margin:0;padding:0;background-color:#F8F9FA;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#F8F9FA;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Outer card, max 560px -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;width:100%;border:1px solid #E2E8F0;">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:#0A1628;padding:28px 40px 24px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;
                letter-spacing:0.42em;text-transform:uppercase;color:#FFFFFF;
                font-weight:400;line-height:1;">TAVOLA</span>
            </td>
          </tr>

          <!-- Gold rule -->
          <tr>
            <td style="background-color:#B8960C;height:2px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#FFFFFF;padding:40px 40px 36px;">

              <!-- Eyebrow label -->
              <p style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;
                font-size:10px;letter-spacing:0.32em;text-transform:uppercase;
                color:#B8960C;line-height:1;">Tavola</p>

              <!-- Heading -->
              <h1 style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;
                font-size:26px;font-weight:400;color:#0A1628;line-height:1.25;">
                ${heading}
              </h1>

              <!-- Body copy -->
              <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,
                'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.75;
                color:#4A5568;">
                ${body}
              </p>

              <!-- CTA button — table trick for reliable email rendering -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:#B8960C;">
                    <a href="${ctaUrl}"
                      style="display:inline-block;padding:14px 36px;
                        font-family:Georgia,'Times New Roman',serif;
                        font-size:11px;letter-spacing:0.22em;text-transform:uppercase;
                        color:#0A1628;text-decoration:none;font-weight:400;
                        mso-padding-alt:14px 36px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:0 0 0 0;font-family:-apple-system,BlinkMacSystemFont,
                'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;
                color:#4A5568;">
                If the button doesn&rsquo;t work, copy and paste this link into your browser:<br />
                <a href="${ctaUrl}"
                  style="color:#B8960C;word-break:break-all;text-decoration:underline;">
                  ${ctaUrl}
                </a>
              </p>

              ${note ? `
              <!-- Note / expiry callout -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin-top:28px;border-top:1px solid #E2E8F0;">
                <tr>
                  <td style="padding:20px 0 0;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                      'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;
                      line-height:1.65;color:#4A5568;">
                      ${note}
                    </p>
                  </td>
                </tr>
              </table>` : ''}

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background-color:#0A1628;padding:24px 40px;">
              <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;
                font-size:10px;letter-spacing:0.35em;text-transform:uppercase;
                color:rgba(255,255,255,0.35);line-height:1;">TAVOLA</p>
              <p style="margin:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,
                'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;
                color:rgba(255,255,255,0.35);">
                AI-powered portfolio monitoring and analysis.
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                'Segoe UI',Helvetica,Arial,sans-serif;font-size:10px;line-height:1.6;
                color:rgba(255,255,255,0.25);">
                NOT INVESTMENT ADVICE. Tavola provides AI-generated analysis for
                informational purposes only. &copy; 2026 Tavola Financial, Inc.
                &bull; <a href="{{ .SiteURL }}/legal/privacy"
                  style="color:rgba(255,255,255,0.35);text-decoration:underline;">Privacy</a>
                &bull; <a href="{{ .SiteURL }}/legal/terms"
                  style="color:rgba(255,255,255,0.35);text-decoration:underline;">Terms</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES = {
  // 1. Confirm signup
  confirmation: {
    subject: 'Confirm your Tavola account',
    html: buildEmail({
      heading:  'Confirm your email address.',
      body:     `Welcome to Tavola. To complete your account setup and access AI-powered portfolio analysis, please confirm your email address by clicking the button below.`,
      ctaLabel: 'Confirm Email Address',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     `This link expires in <strong>24 hours</strong>. If you didn&rsquo;t create a Tavola account, you can safely ignore this email.`,
    }),
  },

  // 2. Magic link / passwordless sign-in
  magic_link: {
    subject: 'Your Tavola sign-in link',
    html: buildEmail({
      heading:  'Sign in to Tavola.',
      body:     `You requested a sign-in link for your Tavola account. Click the button below to access your portfolio dashboard instantly&mdash;no password required.`,
      ctaLabel: 'Sign In to Tavola',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     `This link is single-use and expires in <strong>1 hour</strong>. If you didn&rsquo;t request this, you can safely ignore this email&mdash;your account is secure.`,
    }),
  },

  // 3. Password reset
  recovery: {
    subject: 'Reset your Tavola password',
    html: buildEmail({
      heading:  'Reset your password.',
      body:     `We received a request to reset the password for your Tavola account. Click the button below to choose a new password. If you didn&rsquo;t make this request, no action is needed.`,
      ctaLabel: 'Reset Password',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     `This link expires in <strong>1 hour</strong> and can only be used once. For security, your current password remains unchanged until you complete the reset.`,
    }),
  },

  // 4. Email change confirmation
  email_change: {
    subject: 'Confirm your new email address',
    html: buildEmail({
      heading:  'Confirm your new email.',
      body:     `A request was made to update the email address on your Tavola account. Click the button below to confirm and activate your new address.`,
      ctaLabel: 'Confirm New Email',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     `This link expires in <strong>24 hours</strong>. Your email address will remain unchanged until you confirm. If you didn&rsquo;t request this change, please contact us at <a href="mailto:support@tavola.finance" style="color:#B8960C;">support@tavola.finance</a>.`,
    }),
  },
};

// ── Management API payload ────────────────────────────────────────────────────

const payload = {
  // ── SMTP via Resend ──────────────────────────────────────────────────
  smtp_admin_email:  'noreply@tavola.finance',
  smtp_host:         'smtp.resend.com',
  smtp_port:         465,
  smtp_user:         'resend',
  smtp_pass:         RESEND_API_KEY,
  smtp_sender_name:  'Tavola',
  smtp_max_frequency: 60,  // seconds between sends to the same address

  // ── Email subjects ───────────────────────────────────────────────────
  mailer_subjects_confirmation: TEMPLATES.confirmation.subject,
  mailer_subjects_magic_link:   TEMPLATES.magic_link.subject,
  mailer_subjects_recovery:     TEMPLATES.recovery.subject,
  mailer_subjects_email_change: TEMPLATES.email_change.subject,

  // ── Email HTML bodies ────────────────────────────────────────────────
  mailer_templates_confirmation_content: TEMPLATES.confirmation.html,
  mailer_templates_magic_link_content:   TEMPLATES.magic_link.html,
  mailer_templates_recovery_content:     TEMPLATES.recovery.html,
  mailer_templates_email_change_content: TEMPLATES.email_change.html,
};

// ── Dry run / apply ───────────────────────────────────────────────────────────

if (DRY_RUN) {
  const preview = { ...payload };
  // Truncate HTML bodies for readability in dry-run output
  for (const k of Object.keys(preview)) {
    if (k.endsWith('_content')) {
      preview[k] = preview[k].slice(0, 120) + '… [truncated]';
    }
    if (k === 'smtp_pass') preview[k] = '[REDACTED]';
  }
  console.log('\n[DRY RUN] Payload that would be sent:\n');
  console.log(JSON.stringify(preview, null, 2));
  process.exit(0);
}

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

console.log(`\nApplying email templates to project ${PROJECT_REF}…`);

const res = await fetch(API_URL, {
  method:  'PATCH',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type':  'application/json',
  },
  body: JSON.stringify(payload),
});

const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`\n✗ API error ${res.status}:`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log('\n✓ Auth config updated successfully.');
console.log('\nSMTP configured:');
console.log(`  Host:   smtp.resend.com:465`);
console.log(`  From:   Tavola <noreply@tavola.finance>`);
console.log('\nTemplates applied:');
for (const [key, { subject }] of Object.entries(TEMPLATES)) {
  console.log(`  ${key.padEnd(16)} — "${subject}"`);
}
console.log('\nNext: trigger a test signup to verify branding and deliverability.');

// ── Helpers ───────────────────────────────────────────────────────────────────

function fatal(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Diagnoses and fixes Tavola's Supabase auth email configuration.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx \
 *   SUPABASE_PROJECT_REF=xbielanmtzrzhetidnhx \
 *   RESEND_API_KEY=re_xxx \
 *   node scripts/apply-email-templates.mjs [--diagnose-only]
 *
 * --diagnose-only  Print current config and exit without patching.
 */

const ACCESS_TOKEN   = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF    = process.env.SUPABASE_PROJECT_REF ?? 'xbielanmtzrzhetidnhx';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DIAGNOSE_ONLY  = process.argv.includes('--diagnose-only');

if (!ACCESS_TOKEN)   fatal('SUPABASE_ACCESS_TOKEN is required.');
if (!RESEND_API_KEY) fatal('RESEND_API_KEY is required.');

const BASE = 'https://api.supabase.com';

// ── Step 1: GET current config ────────────────────────────────────────────────

console.log(`\nFetching current auth config for project ${PROJECT_REF}…\n`);

const getRes = await fetch(`${BASE}/v1/projects/${PROJECT_REF}/config/auth`, {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
});

if (!getRes.ok) {
  const t = await getRes.text();
  fatal(`GET failed (${getRes.status}): ${t}`);
}

const cfg = await getRes.json();

// ── Step 2: Print SMTP + mailer state ─────────────────────────────────────────

const SHOW = [
  'external_email_enabled',
  'mailer_autoconfirm',
  'mailer_secure_email_change_enabled',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_sender_name',
  'smtp_admin_email',
  'smtp_max_frequency',
];

console.log('── Current SMTP / mailer state ──────────────────────────────');
for (const f of SHOW) {
  const val = cfg[f];
  const flag = f === 'mailer_autoconfirm' && val === true ? '  ← ✗ PROBLEM' : '';
  console.log(`  ${f.padEnd(38)} ${JSON.stringify(val ?? null)}${flag}`);
}

// Password — never echoed back by API; check if any pass field exists and is truthy
const passFields = Object.entries(cfg)
  .filter(([k]) => k.includes('pass') || k.includes('password'));
console.log(`\n── Password fields in response ──────────────────────────────`);
if (passFields.length === 0) {
  console.log('  (none returned — API redacts password fields; that is normal)');
} else {
  for (const [k, v] of passFields) {
    console.log(`  ${k}: ${v ? '[non-empty]' : '[EMPTY]'}`);
  }
}

// Print every mailer/smtp key in the raw response
console.log('\n── All mailer/smtp keys from GET response ───────────────────');
for (const [k, v] of Object.entries(cfg).sort()) {
  if (!k.includes('smtp') && !k.includes('mailer') && !k.includes('email')) continue;
  const display = (k.includes('pass') || k.includes('password'))
    ? (v ? '[SET]' : '[EMPTY]') : JSON.stringify(v);
  console.log(`  ${k.padEnd(40)} ${display}`);
}

// ── Step 3: Diagnose ──────────────────────────────────────────────────────────

console.log('\n── Diagnosis ────────────────────────────────────────────────');

let problems = 0;

if (cfg.mailer_autoconfirm === true) {
  console.log('  ✗ mailer_autoconfirm is TRUE → all signups are auto-confirmed;');
  console.log('    confirmation emails are never sent regardless of SMTP config.');
  problems++;
}
if (!cfg.smtp_host) {
  console.log('  ✗ smtp_host is empty → custom SMTP not active; Supabase built-in mailer in use.');
  problems++;
}
if (cfg.smtp_host && !cfg.smtp_host.includes('resend')) {
  console.log(`  ✗ smtp_host is "${cfg.smtp_host}" — expected smtp.resend.com`);
  problems++;
}
if (cfg.external_email_enabled === false) {
  console.log('  ✗ external_email_enabled is false → email auth disabled entirely.');
  problems++;
}
if (cfg.smtp_port && cfg.smtp_port !== '465' && cfg.smtp_port !== 465) {
  console.log(`  ⚠ smtp_port is ${cfg.smtp_port}; Resend SMTP requires 465 (SSL) or 587 (STARTTLS).`);
}

if (problems === 0 && cfg.smtp_host?.includes('resend')) {
  console.log('  Config looks structurally correct. Issue is likely smtp_pass not persisted.');
}

if (DIAGNOSE_ONLY) {
  console.log('\n[--diagnose-only] Exiting without patching.\n');
  process.exit(0);
}

// ── Step 4: Build and apply correct config ────────────────────────────────────

console.log('\n── Applying correct config ──────────────────────────────────');

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
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
          style="max-width:560px;width:100%;border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#0A1628;padding:28px 40px 24px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;
                letter-spacing:0.42em;text-transform:uppercase;color:#FFFFFF;
                font-weight:400;line-height:1;">TAVOLA</span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#B8960C;height:2px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;padding:40px 40px 36px;">
              <p style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;
                font-size:10px;letter-spacing:0.32em;text-transform:uppercase;
                color:#B8960C;line-height:1;">Tavola</p>
              <h1 style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;
                font-size:26px;font-weight:400;color:#0A1628;line-height:1.25;">
                ${heading}
              </h1>
              <p style="margin:0 0 28px 0;font-family:-apple-system,BlinkMacSystemFont,
                'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.75;
                color:#4A5568;">
                ${body}
              </p>
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
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,
                'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;
                color:#4A5568;">
                If the button doesn&rsquo;t work, copy and paste this link into your browser:<br />
                <a href="${ctaUrl}"
                  style="color:#B8960C;word-break:break-all;text-decoration:underline;">
                  ${ctaUrl}
                </a>
              </p>
              ${note ? `
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
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const TEMPLATES = {
  confirmation: {
    subject: 'Confirm your Tavola account',
    html: buildEmail({
      heading:  'Confirm your email address.',
      body:     'Welcome to Tavola. To complete your account setup and access AI-powered portfolio analysis, please confirm your email address by clicking the button below.',
      ctaLabel: 'Confirm Email Address',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     'This link expires in <strong>24 hours</strong>. If you didn&rsquo;t create a Tavola account, you can safely ignore this email.',
    }),
  },
  magic_link: {
    subject: 'Your Tavola sign-in link',
    html: buildEmail({
      heading:  'Sign in to Tavola.',
      body:     'You requested a sign-in link for your Tavola account. Click the button below to access your portfolio dashboard instantly — no password required.',
      ctaLabel: 'Sign In to Tavola',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     'This link is single-use and expires in <strong>1 hour</strong>. If you didn&rsquo;t request this, you can safely ignore this email — your account is secure.',
    }),
  },
  recovery: {
    subject: 'Reset your Tavola password',
    html: buildEmail({
      heading:  'Reset your password.',
      body:     'We received a request to reset the password for your Tavola account. Click the button below to choose a new password. If you didn&rsquo;t make this request, no action is needed.',
      ctaLabel: 'Reset Password',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     'This link expires in <strong>1 hour</strong> and can only be used once. Your current password remains unchanged until you complete the reset.',
    }),
  },
  email_change: {
    subject: 'Confirm your new email address',
    html: buildEmail({
      heading:  'Confirm your new email.',
      body:     'A request was made to update the email address on your Tavola account. Click the button below to confirm and activate your new address.',
      ctaLabel: 'Confirm New Email',
      ctaUrl:   '{{ .ConfirmationURL }}',
      note:     'This link expires in <strong>24 hours</strong>. Your email address will remain unchanged until you confirm. If you didn&rsquo;t request this change, contact us at <a href="mailto:support@tavola.finance" style="color:#B8960C;">support@tavola.finance</a>.',
    }),
  },
};

// Build patch — try both smtp_pass and smtp_password to cover API variations
const patch = {
  // ── Mailer behaviour ─────────────────────────────────────────────────
  mailer_autoconfirm:                 false,   // MUST be false to send confirmation emails
  external_email_enabled:             true,
  mailer_secure_email_change_enabled: true,

  // ── Custom SMTP via Resend ───────────────────────────────────────────
  smtp_admin_email:   'noreply@tavola.finance',
  smtp_host:          'smtp.resend.com',
  smtp_port:          '465',
  smtp_user:          'resend',
  smtp_pass:          RESEND_API_KEY,          // field name confirmed by API spec
  smtp_sender_name:   'Tavola',
  smtp_max_frequency: '60',

  // ── Subjects ─────────────────────────────────────────────────────────
  mailer_subjects_confirmation: TEMPLATES.confirmation.subject,
  mailer_subjects_magic_link:   TEMPLATES.magic_link.subject,
  mailer_subjects_recovery:     TEMPLATES.recovery.subject,
  mailer_subjects_email_change: TEMPLATES.email_change.subject,

  // ── HTML templates ───────────────────────────────────────────────────
  mailer_templates_confirmation_content: TEMPLATES.confirmation.html,
  mailer_templates_magic_link_content:   TEMPLATES.magic_link.html,
  mailer_templates_recovery_content:     TEMPLATES.recovery.html,
  mailer_templates_email_change_content: TEMPLATES.email_change.html,
};

const patchRes = await fetch(`${BASE}/v1/projects/${PROJECT_REF}/config/auth`, {
  method:  'PATCH',
  headers: {
    Authorization:  `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(patch),
});

const patchBody = await patchRes.json().catch(() => ({}));

if (!patchRes.ok) {
  console.error(`\n✗ PATCH failed (${patchRes.status}):`);
  console.error(JSON.stringify(patchBody, null, 2));
  process.exit(1);
}

// ── Step 5: Verify written values ─────────────────────────────────────────────

console.log('✓ PATCH succeeded. Re-reading config to verify…\n');

const verifyRes = await fetch(`${BASE}/v1/projects/${PROJECT_REF}/config/auth`, {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
});
const verifyCfg = await verifyRes.json();

console.log('── Verified state ───────────────────────────────────────────');
const VERIFY_FIELDS = [
  'mailer_autoconfirm',
  'external_email_enabled',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_sender_name',
  'smtp_admin_email',
];
for (const f of VERIFY_FIELDS) {
  const val = verifyCfg[f];
  const ok  = val !== null && val !== '' && val !== undefined;
  console.log(`  ${ok ? '✓' : '✗'} ${f.padEnd(38)} ${JSON.stringify(val ?? null)}`);
}

// mailer_autoconfirm must be false
if (verifyCfg.mailer_autoconfirm !== false) {
  console.log('\n  ✗ mailer_autoconfirm is still true — confirmation emails will not send.');
} else {
  console.log('\n  ✓ mailer_autoconfirm = false — confirmation emails will be sent.');
}

console.log('\n── Next steps ───────────────────────────────────────────────');
console.log('  1. Go to Supabase Dashboard → Authentication → Users');
console.log('  2. Delete any test user that was previously created (it may be auto-confirmed)');
console.log('  3. Sign up fresh at /signup with a real email');
console.log('  4. Check Resend dashboard → Emails for the delivery log');
console.log('  5. Paste output above here for final confirmation.\n');

// ── Helpers ───────────────────────────────────────────────────────────────────

function fatal(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

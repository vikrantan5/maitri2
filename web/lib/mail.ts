import sgMail from "@sendgrid/mail";

const key = process.env.SENDGRID_API_KEY;
if (key) {
  sgMail.setApiKey(key);
}

export interface MailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(opts: MailOpts): Promise<{ ok: boolean; error?: string }> {
  if (!key) {
    console.warn("[mail] SENDGRID_API_KEY missing — skipping send");
    return { ok: false, error: "SENDGRID_API_KEY missing" };
  }
  const from = process.env.DEFAULT_FROM_EMAIL || "no-reply@saheli.gov";
  try {
    await sgMail.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.html.replace(/<[^>]+>/g, ""),
    });
    console.log(`[mail] sent → ${opts.to} (${opts.subject})`);
    return { ok: true };
  } catch (e: unknown) {
    const err = (e as { message?: string; response?: { body?: unknown } })?.response?.body
      ? JSON.stringify((e as { response?: { body?: unknown } }).response?.body)
      : (e as Error)?.message;
    console.error("[mail] send failed:", err);
    return { ok: false, error: String(err) };
  }
}

export function stationApprovalEmail(opts: {
  stationName: string;
  stationId: string;
  loginEmail: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  return `
<!doctype html>
<html><body style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0c1220;padding:24px;color:#e7ecf3">
  <div style="max-width:560px;margin:0 auto;background:#131a2c;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px">
    <h1 style="color:#00e5ff;margin:0 0 8px;font-size:22px;">Saheli — Station Approved</h1>
    <p style="color:#8a93a6;margin:0 0 20px;font-size:13px;">Your registration has been approved by Saheli operations.</p>

    <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;margin:16px 0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#8a93a6">Station</div>
      <div style="font-weight:600;margin-top:4px">${opts.stationName}</div>
      <div style="font-family:monospace;color:#00e5ff;font-size:13px;margin-top:4px">${opts.stationId}</div>
    </div>

    <div style="background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.25);border-radius:12px;padding:16px;margin:16px 0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#00e5ff">Login Credentials</div>
      <div style="margin-top:8px"><b>Email:</b> <span style="font-family:monospace">${opts.loginEmail}</span></div>
      <div style="margin-top:4px"><b>Temporary password:</b> <span style="font-family:monospace">${opts.tempPassword}</span></div>
    </div>

    <p style="color:#8a93a6;font-size:12px">
      Please change your password on first login. This credential is unique to your station and grants access to the Saheli command center.
    </p>

    <a href="${opts.loginUrl}" style="display:inline-block;background:#00e5ff;color:#07090f;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:12px">
      Login to dashboard →
    </a>

    <p style="color:#666;font-size:11px;margin-top:32px">Saheli Operations · government-grade emergency response</p>
  </div>
</body></html>
  `;
}

export function officerApprovalEmail(opts: {
  officerName: string;
  stationId: string;
  loginEmail: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  return `
<!doctype html>
<html><body style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0c1220;padding:24px;color:#e7ecf3">
  <div style="max-width:560px;margin:0 auto;background:#131a2c;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px">
    <h1 style="color:#00e5ff;margin:0 0 8px;font-size:22px;">Saheli — Officer Onboarded</h1>
    <p style="color:#8a93a6;margin:0 0 20px;font-size:13px;">Hello ${opts.officerName}, your registration has been approved by your station.</p>

    <div style="background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.25);border-radius:12px;padding:16px;margin:16px 0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#00e5ff">Login Credentials</div>
      <div style="margin-top:8px"><b>Email:</b> <span style="font-family:monospace">${opts.loginEmail}</span></div>
      <div style="margin-top:4px"><b>Temporary password:</b> <span style="font-family:monospace">${opts.tempPassword}</span></div>
      <div style="margin-top:4px"><b>Station:</b> <span style="font-family:monospace">${opts.stationId}</span></div>
    </div>

    <a href="${opts.loginUrl}" style="display:inline-block;background:#00e5ff;color:#07090f;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:12px">
      Login →
    </a>
  </div>
</body></html>
  `;
}

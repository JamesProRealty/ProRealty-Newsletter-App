const nodemailer = require("nodemailer");

let resendClient = null;
let smtpTransport = null;

function getProvider() {
  return (process.env.EMAIL_PROVIDER || "resend").toLowerCase();
}

function getResend() {
  if (!resendClient) {
    const { Resend } = require("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSmtp() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return smtpTransport;
}

/**
 * Sends a single email. Throws on failure (caller should catch per-recipient).
 */
async function sendEmail({ to, subject, html }) {
  const provider = getProvider();
  const fromName = process.env.FROM_NAME || "Newsletter";
  const fromEmail = process.env.FROM_EMAIL;

  if (provider === "resend") {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message || JSON.stringify(error));
    return true;
  }

  if (provider === "smtp") {
    const transport = getSmtp();
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    });
    return true;
  }

  throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`);
}

module.exports = { sendEmail };

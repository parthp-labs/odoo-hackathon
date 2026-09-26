import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Always log OTP to server console in development for frictionless testing,
// regardless of which transport is selected.
function logDispatch({ to, purpose, subject, otpCode }) {
  if (process.env.NODE_ENV === 'production') return;
  console.log('\n======================================================');
  console.log(`[EMAIL DISPATCH] To: ${to}`);
  console.log(`[EMAIL PURPOSE]  ${purpose || subject}`);
  if (otpCode) {
    console.log(`[VERIFICATION CODE] >>> ${otpCode} <<<`);
  }
  console.log('======================================================\n');
}

const sendEmail = async ({ to, subject, text, html, otpCode, purpose }) => {
  logDispatch({ to, purpose, subject, otpCode });

  // 1) Resend (preferred): used only when explicitly opted in via
    //    MAILER_MODE=resend AND a key + sender are present, and NOT under
    //    NODE_ENV=test. Default/test runs never make real outbound calls, so a
    //    suite using fake addresses (e.g. example.com) cannot hit Resend.
    if (
      process.env.NODE_ENV !== 'test' &&
      process.env.MAILER_MODE === 'resend' &&
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM
    ) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text: text || (otpCode ? `Your code is: ${otpCode}` : ''),
      html,
    });
    if (error) {
      // Do not swallow a genuine delivery failure silently.
      throw new Error(`Resend delivery failed: ${error.message}`);
    }
    return { messageId: data?.id, provider: 'resend' };
  }

  // 2) SMTP (legacy nodemailer): used if Resend is not configured but SMTP is.
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || '"StockSense IMS" <noreply@stocksense.io>',
      to,
      subject,
      text,
      html,
    });

    return info;
  }

  // 3) Dev fallback: nothing configured — the code is visible in the console
  //    log emitted at the top of this function.
  return { messageId: 'dev-console-fallback', provider: 'log' };
};

export default sendEmail;
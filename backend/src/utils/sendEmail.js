import nodemailer from 'nodemailer';

const sendEmail = async ({ to, subject, text, html, otpCode, purpose }) => {
  // Always log OTP to server console in development for frictionless testing
  if (process.env.NODE_ENV !== 'production' || !process.env.SMTP_HOST) {
    console.log('\n======================================================');
    console.log(`[EMAIL DISPATCH] To: ${to}`);
    console.log(`[EMAIL PURPOSE]  ${purpose || subject}`);
    if (otpCode) {
      console.log(`[VERIFICATION CODE] >>> ${otpCode} <<<`);
    }
    console.log('======================================================\n');
  }

  // If SMTP configuration is provided, send real email
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

  return { messageId: 'dev-console-fallback' };
};

export default sendEmail;

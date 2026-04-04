require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  console.log('Sending from:', process.env.SMTP_USER);
  console.log('Sending to:', process.env.NOTIFICATION_EMAIL);
  
  try {
    const info = await transporter.sendMail({
      from: `"Uthsav Alerts" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFICATION_EMAIL,
      subject: 'Test Email from Uthsav Invites',
      html: '<b>This is a test</b>'
    });
    console.log('Email sent successfully:', info.messageId);
  } catch (err) {
    console.error('Email failed to send:', err);
  }
}

testEmail();


const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

async function sendEmail({ to, subject, html }) {
   try{

     if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
       throw new Error("SMTP configuration is incomplete.");
     }
   
     if (!to) {
       throw new Error("Email recipient is missing.");
     }
   
     const result = await transporter.sendMail({
       from: process.env.MAIL_FROM || process.env.SMTP_USER,
       to,
       subject,
       html,
     });
   
     console.log("Email accepted by SMTP server:", {
       messageId: result.messageId,
       accepted: result.accepted,
       rejected: result.rejected,
     });
   
     if (!result.accepted || result.accepted.length === 0) {
       throw new Error("SMTP server did not accept the recipient.");
     }
     console.log(result)
     return result;
   } catch (err){
    console.log(err)
   }
}

module.exports = { sendEmail };

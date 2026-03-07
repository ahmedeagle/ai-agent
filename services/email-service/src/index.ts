import express from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.EMAIL_SERVICE_PORT || 3013;

// ============ HELPER: GET COMPANY-SPECIFIC EMAIL TRANSPORTER ============

async function getCompanyEmailTransporter(companyId: string): Promise<nodemailer.Transporter> {
  // Fetch company SMTP settings
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassword: true,
      smtpSecure: true,
      emailFrom: true
    }
  });

  // If company has custom SMTP settings, use them
  if (company?.smtpHost && company?.smtpUser && company?.smtpPassword) {
    return nodemailer.createTransport({
      host: company.smtpHost,
      port: company.smtpPort || 587,
      secure: company.smtpSecure || false,
      auth: {
        user: company.smtpUser,
        pass: company.smtpPassword
      }
    });
  }

  // Otherwise, fall back to system default transporter
  return getSystemDefaultTransporter();
}

function getSystemDefaultTransporter(): nodemailer.Transporter {
  if (process.env.SENDGRID_API_KEY) {
    // SendGrid
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  } else {
    // Standard SMTP
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
}

// Email transporter (kept for backward compatibility, but prefer using getCompanyEmailTransporter)
let transporter: nodemailer.Transporter = getSystemDefaultTransporter();

app.use(express.json());

// ============ EMAIL TEMPLATES ============

const templates = {
  callSummary: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .info-box { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Call Summary</h1>
  </div>
  <div class="content">
    <h2>Thank you for contacting {{companyName}}</h2>
    <p>Here's a summary of your recent call:</p>
    
    <div class="info-box">
      <p><strong>Date:</strong> {{callDate}}</p>
      <p><strong>Duration:</strong> {{duration}} minutes</p>
      <p><strong>Status:</strong> {{status}}</p>
      {{#if agentName}}
      <p><strong>Agent:</strong> {{agentName}}</p>
      {{/if}}
    </div>

    {{#if summary}}
    <h3>Call Summary</h3>
    <p>{{summary}}</p>
    {{/if}}

    {{#if transcriptUrl}}
    <p><a href="{{transcriptUrl}}" class="button">View Transcript</a></p>
    {{/if}}

    {{#if recordingUrl}}
    <p><a href="{{recordingUrl}}" class="button">Listen to Recording</a></p>
    {{/if}}

    {{#if followUpRequired}}
    <p><strong>Follow-up:</strong> A team member will contact you within 24 hours.</p>
    {{/if}}
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyEmail}} | {{companyPhone}}</p>
    <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
  </div>
</body>
</html>
  `,

  transcript: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .transcript { background: #f9f9f9; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0; }
    .speaker { font-weight: bold; color: #4F46E5; }
    .timestamp { color: #666; font-size: 12px; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Call Transcript</h1>
  </div>
  <div class="content">
    <p><strong>Call Date:</strong> {{callDate}}</p>
    <p><strong>Duration:</strong> {{duration}} minutes</p>
    
    <div class="transcript">
      {{#each messages}}
        <p>
          <span class="timestamp">[{{this.timestamp}}]</span>
          <span class="speaker">{{this.speaker}}:</span>
          {{this.text}}
        </p>
      {{/each}}
    </div>

    {{#if actionItems}}
    <h3>Action Items</h3>
    <ul>
      {{#each actionItems}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
    {{/if}}
  </div>
  <div class="footer">
    <p>{{companyName}} | {{companyEmail}}</p>
  </div>
</body>
</html>
  `,

  voicemail: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>New Voicemail</h1>
  </div>
  <div class="content">
    <p>You have a new voicemail from <strong>{{callerNumber}}</strong></p>
    <p><strong>Received:</strong> {{receivedAt}}</p>
    <p><strong>Duration:</strong> {{duration}} seconds</p>
    
    {{#if transcription}}
    <h3>Transcription:</h3>
    <p style="background: #f9f9f9; padding: 15px; border-left: 4px solid #4F46E5;">
      {{transcription}}
    </p>
    {{/if}}

    <p><a href="{{audioUrl}}" class="button">Listen to Voicemail</a></p>
    
    {{#if callbackUrl}}
    <p><a href="{{callbackUrl}}" class="button">Return Call</a></p>
    {{/if}}
  </div>
  <div class="footer">
    <p>{{companyName}}</p>
  </div>
</body>
</html>
  `,

  notification: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: {{#if urgent}}#EF4444{{else}}#4F46E5{{/if}}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .alert { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 15px; margin: 10px 0; }
    .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>{{title}}</h1>
  </div>
  <div class="content">
    {{#if urgent}}
    <div class="alert">
      <strong>⚠️ Urgent Notification</strong>
    </div>
    {{/if}}
    
    <p>{{message}}</p>

    {{#if actionUrl}}
    <p><a href="{{actionUrl}}" class="button">{{actionText}}</a></p>
    {{/if}}

    {{#if details}}
    <h3>Details:</h3>
    <ul>
      {{#each details}}
        <li><strong>{{this.label}}:</strong> {{this.value}}</li>
      {{/each}}
    </ul>
    {{/if}}
  </div>
  <div class="footer">
    <p>{{companyName}}</p>
  </div>
</body>
</html>
  `
};

// ============ SEND EMAIL ============

app.post('/email/send', async (req, res) => {
  try {
    const {
      to,
      subject,
      template,
      data,
      companyId,
      customerId,
      callId,
      attachments
    } = req.body;

    // Get company info
    const company = await prisma.company.findUnique({
      where: {id: companyId}
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const from = company.emailFrom || process.env.SMTP_FROM || process.env.SMTP_USER;

    // Compile template
    const templateContent = templates[template as keyof typeof templates] || template;
    const compiledTemplate = Handlebars.compile(templateContent);
    const html = compiledTemplate({
      ...data,
      companyName: company.name,
      companyEmail: company.emailFrom,
      companyPhone: company.twilioPhoneNumber
    });

    // Prepare attachments
    const mailAttachments = attachments?.map((att: any) => ({
      filename: att.filename,
      path: att.url || att.path,
      contentType: att.contentType
    })) || [];

    // Use per-company transporter if configured, otherwise system default
    const companyTransporter = await getCompanyEmailTransporter(companyId);
    const info = await companyTransporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments: mailAttachments
    });

    // Save to database
    const email = await prisma.emailMessage.create({
      data: {
        to,
        from,
        subject,
        body: html,
        companyId,
        customerId,
        callId,
        status: 'sent',
        messageId: info.messageId,
        sentAt: new Date()
      }
    });

    res.json({success: true, data: email});
  } catch (error: any) {
    console.error('Email send error:', error);
    res.status(500).json({success: false, error: error.message});
  }
});

// Send call summary email
app.post('/email/call-summary', async (req, res) => {
  try {
    const {callId} = req.body;

    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {
        company: true,
        customer: true,
        agent: true
      }
    });

    if (!call) {
      throw new Error('Call not found');
    }

    const customer = call.customer;
    if (!customer?.email) {
      throw new Error('Customer email not found');
    }

    // Compile template
    const compiledTemplate = Handlebars.compile(templates.callSummary);
    const html = compiledTemplate({
      companyName: call.company.name,
      companyEmail: call.company.emailFrom,
      companyPhone: call.company.twilioPhoneNumber,
      callDate: call.createdAt.toLocaleDateString(),
      duration: Math.round(call.duration / 60),
      status: call.status,
      agentName: call.agent?.name,
      summary: call.summary,
      transcriptUrl: call.transcriptUrl,
      recordingUrl: call.recordingUrl,
      followUpRequired: call.status === 'requires_followup'
    });

    const info = await transporter.sendMail({
      from: call.company.emailFrom || process.env.SMTP_FROM,
      to: customer.email,
      subject: `Call Summary - ${call.company.name}`,
      html
    });

    const email = await prisma.emailMessage.create({
      data: {
        to: customer.email,
        from: call.company.emailFrom || process.env.SMTP_FROM,
        subject: `Call Summary - ${call.company.name}`,
        body: html,
        companyId: call.companyId,
        customerId: call.customerId,
        callId: call.id,
        status: 'sent',
        messageId: info.messageId,
        sentAt: new Date()
      }
    });

    res.json({success: true, data: email});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send transcript email
app.post('/email/transcript', async (req, res) => {
  try {
    const {callId, to} = req.body;

    const call = await prisma.call.findUnique({
      where: {id: callId},
      include: {company: true}
    });

    if (!call) {
      throw new Error('Call not found');
    }

    // Parse transcript
    const messages = call.transcript ? JSON.parse(call.transcript) : [];

    const compiledTemplate = Handlebars.compile(templates.transcript);
    const html = compiledTemplate({
      companyName: call.company.name,
      companyEmail: call.company.emailFrom,
      callDate: call.createdAt.toLocaleDateString(),
      duration: Math.round(call.duration / 60),
      messages,
      actionItems: call.actionItems || []
    });

    const info = await transporter.sendMail({
      from: call.company.emailFrom || process.env.SMTP_FROM,
      to,
      subject: `Call Transcript - ${call.company.name}`,
      html
    });

    const email = await prisma.emailMessage.create({
      data: {
        to,
        from: call.company.emailFrom || process.env.SMTP_FROM,
        subject: `Call Transcript - ${call.company.name}`,
        body: html,
        companyId: call.companyId,
        callId: call.id,
        status: 'sent',
        messageId: info.messageId,
        sentAt: new Date()
      }
    });

    res.json({success: true, data: email});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send voicemail notification
app.post('/email/voicemail', async (req, res) => {
  try {
    const {voicemailId, to} = req.body;

    const voicemail = await prisma.voicemail.findUnique({
      where: {id: voicemailId},
      include: {company: true}
    });

    if (!voicemail) {
      throw new Error('Voicemail not found');
    }

    const compiledTemplate = Handlebars.compile(templates.voicemail);
    const html = compiledTemplate({
      companyName: voicemail.company.name,
      callerNumber: voicemail.from,
      receivedAt: voicemail.createdAt.toLocaleString(),
      duration: voicemail.duration,
      transcription: voicemail.transcription,
      audioUrl: voicemail.audioUrl
    });

    const info = await transporter.sendMail({
      from: voicemail.company.emailFrom || process.env.SMTP_FROM,
      to,
      subject: `New Voicemail from ${voicemail.from}`,
      html
    });

    res.json({success: true, messageId: info.messageId});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Send custom notification
app.post('/email/notification', async (req, res) => {
  try {
    const {to, title, message, companyId, urgent, actionUrl, actionText, details} = req.body;

    const company = await prisma.company.findUnique({
      where: {id: companyId}
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const compiledTemplate = Handlebars.compile(templates.notification);
    const html = compiledTemplate({
      companyName: company.name,
      title,
      message,
      urgent,
      actionUrl,
      actionText,
      details
    });

    const info = await transporter.sendMail({
      from: company.emailFrom || process.env.SMTP_FROM,
      to,
      subject: title,
      html
    });

    res.json({success: true, messageId: info.messageId});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ EMAIL HISTORY & ANALYTICS ============

// Get email history
app.get('/email/history/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {limit = 50, offset = 0} = req.query;

    const emails = await prisma.emailMessage.findMany({
      where: {companyId},
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        customer: true,
        call: true
      }
    });

    res.json({success: true, data: emails});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get email analytics
app.get('/email/analytics/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {startDate, endDate} = req.query;

    const where: any = {companyId};
    if (startDate || endDate) {
      where.createdAt = {
        gte: startDate ? new Date(startDate as string) : undefined,
        lte: endDate ? new Date(endDate as string) : undefined
      };
    }

    const emails = await prisma.emailMessage.findMany({where});

    const analytics = {
      total: emails.length,
      sent: emails.filter(e => e.status === 'sent').length,
      failed: emails.filter(e => e.status === 'failed').length,
      deliveryRate: (emails.filter(e => e.status === 'sent').length / emails.length) * 100 || 0
    };

    res.json({success: true, data: analytics});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'email-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📧 Email Service running on port ${PORT}`);
});

export default app;

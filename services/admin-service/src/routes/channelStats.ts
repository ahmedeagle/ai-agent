import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get channel stats (WhatsApp, SMS, Email counts) for a company
router.get('/', async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const baseWhere = {
      companyId: companyId as string,
      ...(hasDateFilter ? { createdAt: dateFilter } : {})
    };

    // Run all queries in parallel
    const [
      whatsappTotal,
      whatsappInbound,
      whatsappOutbound,
      whatsappDelivered,
      whatsappFailed,
      smsTotal,
      smsInbound,
      smsOutbound,
      smsDelivered,
      smsFailed,
      emailTotal,
      emailSent,
      emailDelivered,
      emailFailed,
    ] = await Promise.all([
      // WhatsApp
      prisma.whatsAppMessage.count({ where: baseWhere }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, direction: 'inbound' } }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, direction: 'outbound' } }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, status: { in: ['delivered', 'read'] } } }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, status: 'failed' } }),
      // SMS
      prisma.sMSMessage.count({ where: baseWhere }),
      prisma.sMSMessage.count({ where: { ...baseWhere, direction: 'inbound' } }),
      prisma.sMSMessage.count({ where: { ...baseWhere, direction: 'outbound' } }),
      prisma.sMSMessage.count({ where: { ...baseWhere, status: { in: ['delivered', 'sent'] } } }),
      prisma.sMSMessage.count({ where: { ...baseWhere, status: 'failed' } }),
      // Email
      prisma.emailMessage.count({ where: baseWhere }),
      prisma.emailMessage.count({ where: { ...baseWhere, status: { in: ['sent', 'delivered'] } } }),
      prisma.emailMessage.count({ where: { ...baseWhere, status: 'delivered' } }),
      prisma.emailMessage.count({ where: { ...baseWhere, status: { in: ['failed', 'bounced'] } } }),
    ]);

    res.json({
      success: true,
      data: {
        whatsapp: {
          total: whatsappTotal,
          inbound: whatsappInbound,
          outbound: whatsappOutbound,
          delivered: whatsappDelivered,
          failed: whatsappFailed,
        },
        sms: {
          total: smsTotal,
          inbound: smsInbound,
          outbound: smsOutbound,
          delivered: smsDelivered,
          failed: smsFailed,
        },
        email: {
          total: emailTotal,
          sent: emailSent,
          delivered: emailDelivered,
          failed: emailFailed,
        }
      }
    });
  } catch (error) {
    console.error('Failed to get channel stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get channel stats' });
  }
});

export default router;

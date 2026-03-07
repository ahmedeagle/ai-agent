import express from 'express';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.BILLING_SERVICE_PORT || 3015;

app.use(express.json());

// ============ PACKAGE MANAGEMENT ============

// Create package (purchase)
app.post('/billing/packages', async (req, res) => {
  try {
    const {
      companyId,
      name,
      type,
      minutesIncluded,
      concurrentAgentsIncluded,
      pricePerAgent,
      totalPrice,
      billingCycle,
      expiresAt
    } = req.body;

    const packageData = await prisma.package.create({
      data: {
        companyId,
        name,
        type,
        minutesIncluded: minutesIncluded || 0,
        minutesRemaining: minutesIncluded || 0,
        concurrentAgentsIncluded: concurrentAgentsIncluded || 1,
        pricePerAgent: pricePerAgent || 0,
        totalPrice,
        billingCycle,
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    // Update company limits
    await prisma.company.update({
      where: {id: companyId},
      data: {
        minutesAllocated: {increment: minutesIncluded || 0},
        maxConcurrentAgents: concurrentAgentsIncluded || 1,
        subscriptionStatus: 'active'
      }
    });

    res.json({success: true, data: packageData});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get company packages
app.get('/billing/packages/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;

    const packages = await prisma.package.findMany({
      where: {companyId},
      orderBy: {createdAt: 'desc'}
    });

    res.json({success: true, data: packages});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get active package
app.get('/billing/packages/:companyId/active', async (req, res) => {
  try {
    const {companyId} = req.params;

    const activePackage = await prisma.package.findFirst({
      where: {
        companyId,
        status: 'active',
        OR: [
          {expiresAt: null},
          {expiresAt: {gt: new Date()}}
        ]
      },
      orderBy: {createdAt: 'desc'}
    });

    res.json({success: true, data: activePackage});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ CONCURRENT AGENT BILLING ============

// Update concurrent agent limit (dynamic pricing)
app.post('/billing/concurrent-agents/update', async (req, res) => {
  try {
    const {companyId, newLimit, pricePerAgent} = req.body;

    const company = await prisma.company.findUnique({
      where: {id: companyId}
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const currentLimit = company.maxConcurrentAgents;
    const additionalAgents = newLimit - currentLimit;

    if (additionalAgents <= 0) {
      throw new Error('New limit must be greater than current limit');
    }

    const additionalCost = additionalAgents * pricePerAgent;

    // Create usage log for additional agents
    await prisma.usageLog.create({
      data: {
        companyId,
        type: 'concurrent_agent',
        quantity: additionalAgents,
        cost: additionalCost,
        description: `Increased concurrent agents from ${currentLimit} to ${newLimit}`,
        metadata: {
          oldLimit: currentLimit,
          newLimit,
          pricePerAgent
        }
      }
    });

    // Update company limit
    await prisma.company.update({
      where: {id: companyId},
      data: {maxConcurrentAgents: newLimit}
    });

    res.json({
      success: true,
      data: {
        oldLimit: currentLimit,
        newLimit,
        additionalAgents,
        additionalCost
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Check if company can start new concurrent call
app.post('/billing/concurrent-agents/check', async (req, res) => {
  try {
    const {companyId} = req.body;

    const company = await prisma.company.findUnique({
      where: {id: companyId}
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const canStart = company.currentConcurrentAgents < company.maxConcurrentAgents;
    const remainingSlots = company.maxConcurrentAgents - company.currentConcurrentAgents;

    res.json({
      success: true,
      data: {
        canStart,
        currentConcurrent: company.currentConcurrentAgents,
        maxConcurrent: company.maxConcurrentAgents,
        remainingSlots,
        needsUpgrade: !canStart
      }
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Increment concurrent call count
app.post('/billing/concurrent-agents/increment', async (req, res) => {
  try {
    const {companyId} = req.body;

    const company = await prisma.company.update({
      where: {id: companyId},
      data: {
        currentConcurrentAgents: {increment: 1}
      }
    });

    res.json({
      success: true,
      data: {currentConcurrent: company.currentConcurrentAgents}
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Decrement concurrent call count
app.post('/billing/concurrent-agents/decrement', async (req, res) => {
  try {
    const {companyId} = req.body;

    const company = await prisma.company.update({
      where: {id: companyId},
      data: {
        currentConcurrentAgents: {decrement: 1}
      }
    });

    res.json({
      success: true,
      data: {currentConcurrent: company.currentConcurrentAgents}
    });
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ USAGE TRACKING ============

// Log call minutes usage
app.post('/billing/usage/call', async (req, res) => {
  try {
    const {companyId, callId, durationMinutes} = req.body;

    // Get active package
    const activePackage = await prisma.package.findFirst({
      where: {
        companyId,
        status: 'active',
        OR: [
          {expiresAt: null},
          {expiresAt: {gt: new Date()}}
        ]
      },
      orderBy: {createdAt: 'desc'}
    });

    let cost = 0;
    if (activePackage) {
      // Deduct from package
      if (activePackage.minutesRemaining >= durationMinutes) {
        await prisma.package.update({
          where: {id: activePackage.id},
          data: {
            minutesUsed: {increment: durationMinutes},
            minutesRemaining: {decrement: durationMinutes}
          }
        });
      } else {
        // Package exhausted, charge overage
        const overageMinutes = durationMinutes - activePackage.minutesRemaining;
        cost = overageMinutes * (activePackage.pricePerMinute || 0);

        await prisma.package.update({
          where: {id: activePackage.id},
          data: {
            minutesUsed: {increment: durationMinutes},
            minutesRemaining: 0
          }
        });
      }
    }

    // Update company usage
    await prisma.company.update({
      where: {id: companyId},
      data: {
        minutesUsed: {increment: durationMinutes}
      }
    });

    // Create usage log
    const usageLog = await prisma.usageLog.create({
      data: {
        companyId,
        packageId: activePackage?.id,
        callId,
        type: 'call_minutes',
        quantity: durationMinutes,
        cost,
        description: `Call duration: ${durationMinutes} minutes`
      }
    });

    // Check if nearing limit (80% used)
    if (activePackage && activePackage.minutesRemaining < activePackage.minutesIncluded * 0.2) {
      await prisma.notification.create({
        data: {
          companyId,
          type: 'billing',
          title: 'Minutes Running Low',
          message: `You have used ${Math.round((activePackage.minutesUsed / activePackage.minutesIncluded) * 100)}% of your package minutes.`,
          priority: 'high'
        }
      });
    }

    res.json({success: true, data: usageLog});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get usage summary
app.get('/billing/usage/:companyId/summary', async (req, res) => {
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

    const logs = await prisma.usageLog.findMany({where});

    const summary = {
      totalCost: logs.reduce((sum, log) => sum + log.cost, 0),
      byType: {
        call_minutes: {
          count: logs.filter(l => l.type === 'call_minutes').length,
          quantity: logs.filter(l => l.type === 'call_minutes').reduce((sum, l) => sum + l.quantity, 0),
          cost: logs.filter(l => l.type === 'call_minutes').reduce((sum, l) => sum + l.cost, 0)
        },
        concurrent_agent: {
          count: logs.filter(l => l.type === 'concurrent_agent').length,
          quantity: logs.filter(l => l.type === 'concurrent_agent').reduce((sum, l) => sum + l.quantity, 0),
          cost: logs.filter(l => l.type === 'concurrent_agent').reduce((sum, l) => sum + l.cost, 0)
        },
        sms: {
          count: logs.filter(l => l.type === 'sms').length,
          cost: logs.filter(l => l.type === 'sms').reduce((sum, l) => sum + l.cost, 0)
        },
        whatsapp: {
          count: logs.filter(l => l.type === 'whatsapp').length,
          cost: logs.filter(l => l.type === 'whatsapp').reduce((sum, l) => sum + l.cost, 0)
        }
      }
    };

    res.json({success: true, data: summary});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get usage logs
app.get('/billing/usage/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;
    const {limit = 100, offset = 0} = req.query;

    const logs = await prisma.usageLog.findMany({
      where: {companyId},
      orderBy: {createdAt: 'desc'},
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({success: true, data: logs});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// ============ INVOICING ============

// Generate invoice
app.post('/billing/invoices/generate', async (req, res) => {
  try {
    const {companyId, periodStart, periodEnd} = req.body;

    // Get usage for period
    const logs = await prisma.usageLog.findMany({
      where: {
        companyId,
        createdAt: {
          gte: new Date(periodStart),
          lte: new Date(periodEnd)
        }
      }
    });

    const subtotal = logs.reduce((sum, log) => sum + log.cost, 0);
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    // Build line items
    const items = [
      {description: 'Call Minutes', amount: logs.filter(l => l.type === 'call_minutes').reduce((sum, l) => sum + l.cost, 0)},
      {description: 'Additional Concurrent Agents', amount: logs.filter(l => l.type === 'concurrent_agent').reduce((sum, l) => sum + l.cost, 0)},
      {description: 'SMS Messages', amount: logs.filter(l => l.type === 'sms').reduce((sum, l) => sum + l.cost, 0)},
      {description: 'WhatsApp Messages', amount: logs.filter(l => l.type === 'whatsapp').reduce((sum, l) => sum + l.cost, 0)}
    ].filter(item => item.amount > 0);

    // Generate invoice number
    const invoiceCount = await prisma.invoice.count({where: {companyId}});
    const invoiceNumber = `INV-${companyId.substring(0, 8).toUpperCase()}-${String(invoiceCount + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        subtotal,
        tax,
        total,
        items,
        status: 'pending'
      }
    });

    res.json({success: true, data: invoice});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Get invoices
app.get('/billing/invoices/:companyId', async (req, res) => {
  try {
    const {companyId} = req.params;

    const invoices = await prisma.invoice.findMany({
      where: {companyId},
      orderBy: {createdAt: 'desc'},
      include: {
        payments: true
      }
    });

    res.json({success: true, data: invoices});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Mark invoice as paid
app.post('/billing/invoices/:invoiceId/pay', async (req, res) => {
  try {
    const {invoiceId} = req.params;
    const {amount, paymentMethod, transactionId} = req.body;

    const invoice = await prisma.invoice.update({
      where: {id: invoiceId},
      data: {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod
      }
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        paymentMethod,
        transactionId,
        status: 'completed',
        paidAt: new Date()
      }
    });

    res.json({success: true, data: invoice});
  } catch (error: any) {
    res.status(500).json({success: false, error: error.message});
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'billing-service',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`💰 Billing Service running on port ${PORT}`);
});

export default app;

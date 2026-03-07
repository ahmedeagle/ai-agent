import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.TOOL_EXECUTION_PORT || 3002;
const prisma = new PrismaClient();

app.use(express.json());

// Execute a tool
app.post('/execute', async (req, res) => {
  try {
    const { toolName, parameters, agentId, callId } = req.body;

    // Get tool configuration
    const tool = await prisma.tool.findFirst({
      where: { name: toolName, active: true }
    });

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }

    // Execute the tool
    const result = await executeTool(tool, parameters);

    // Log the execution
    if (callId) {
      await prisma.toolCall.create({
        data: {
          callId,
          toolId: tool.id,
          parameters,
          result,
          success: result.success || false
        }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed'
    });
  }
});

// Get tool usage stats
app.get('/stats', async (req, res) => {
  try {
    const { companyId, toolId } = req.query;

    const stats = await prisma.toolCall.groupBy({
      by: ['toolId', 'success'],
      where: {
        ...(toolId && { toolId: toolId as string })
      },
      _count: true
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'tool-execution-service', status: 'healthy' });
});

// Tool execution logic
async function executeTool(tool: any, parameters: any): Promise<any> {
  try {
    const headers: any = {
      'Content-Type': 'application/json',
      ...(tool.apiKey && { 'Authorization': `Bearer ${tool.apiKey}` }),
      ...(tool.headers || {})
    };

    const response = await axios({
      method: tool.method.toLowerCase(),
      url: tool.endpoint,
      data: parameters,
      headers,
      timeout: 30000
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      statusCode: error.response?.status
    };
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Tool Execution Service running on port ${PORT}`);
});

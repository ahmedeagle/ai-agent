import WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { CallSessionManager } from '../managers/callSession';
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ADMIN_SERVICE_URL = `http://admin-service:${process.env.ADMIN_SERVICE_PORT || 3004}`;

interface StreamSession {
  callSid: string;
  streamSid?: string;
  agentId?: string;
  systemPrompt?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  openaiWs?: WebSocket;
}

const activeSessions = new Map<string, StreamSession>();

export function setupMediaStreamWebSocket(server: HttpServer, sessionManager: CallSessionManager) {
  const wss = new WebSocket.Server({ noServer: true });

  // Handle HTTP upgrade to WebSocket for /stream/:callSid paths
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';
    
    if (pathname.startsWith('/stream/')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        const callSid = pathname.replace('/stream/', '');
        logger.info(`WebSocket upgrade for call: ${callSid}`);
        wss.emit('connection', ws, request, callSid);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, _request: any, callSid: string) => {
    logger.info(`Twilio media stream connected for call: ${callSid}`);

    const session: StreamSession = {
      callSid,
      conversationHistory: []
    };
    activeSessions.set(callSid, session);

    // If OpenAI Realtime API is available, connect to it
    if (OPENAI_API_KEY) {
      connectOpenAIRealtime(session, ws);
    }

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.event) {
          case 'connected':
            logger.info(`Media stream connected: ${callSid}`);
            break;

          case 'start':
            session.streamSid = msg.start?.streamSid;
            logger.info(`Media stream started: ${session.streamSid}`);
            
            // Load agent config and send initial greeting
            loadAgentAndGreet(session, ws);
            break;

          case 'media':
            // Forward audio to OpenAI Realtime API if connected
            if (session.openaiWs?.readyState === WebSocket.OPEN) {
              session.openaiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: msg.media.payload // base64 mulaw audio
              }));
            }
            break;

          case 'stop':
            logger.info(`Media stream stopped for call: ${callSid}`);
            cleanup(callSid);
            break;
        }
      } catch (error) {
        logger.error('Error processing media stream message:', error);
      }
    });

    ws.on('close', () => {
      logger.info(`Media stream WebSocket closed for call: ${callSid}`);
      cleanup(callSid);
    });

    ws.on('error', (error) => {
      logger.error(`Media stream WebSocket error for call ${callSid}:`, error);
      cleanup(callSid);
    });
  });

  logger.info('Twilio Media Stream WebSocket handler initialized');
}

async function loadAgentAndGreet(session: StreamSession, twilioWs: WebSocket) {
  try {
    // Get the agent config from the call session
    const callData = await getCallSession(session.callSid);
    if (callData?.agentId) {
      session.agentId = callData.agentId;
      
      // Fetch agent configuration
      try {
        const res = await axios.get(`${ADMIN_SERVICE_URL}/agent/${callData.agentId}`);
        const agent = res.data?.data;
        if (agent?.systemPrompt) {
          session.systemPrompt = agent.systemPrompt;
        }
      } catch (e) {
        logger.warn('Could not fetch agent config, using default prompt');
      }
    }

    // If OpenAI Realtime is connected, configure it with the system prompt
    if (session.openaiWs?.readyState === WebSocket.OPEN && session.systemPrompt) {
      session.openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: session.systemPrompt,
          voice: 'alloy',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));

      // Send initial greeting
      session.openaiWs.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: 'Greet the caller warmly and ask how you can help them today.'
        }
      }));
    } else if (!OPENAI_API_KEY) {
      // No OpenAI key - use TTS fallback with a simple greeting
      logger.warn('No OpenAI API key configured - voice AI will not function');
      // Send a text-based greeting via Twilio's TTS as fallback
      sendTwilioMark(twilioWs, session.streamSid!, 'no-ai');
    }
  } catch (error) {
    logger.error('Error loading agent config:', error);
  }
}

function connectOpenAIRealtime(session: StreamSession, twilioWs: WebSocket) {
  try {
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    session.openaiWs = openaiWs;

    openaiWs.on('open', () => {
      logger.info(`OpenAI Realtime connected for call: ${session.callSid}`);
      
      // Configure the session
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          voice: 'alloy',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));
    });

    openaiWs.on('message', (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());

        switch (event.type) {
          case 'session.created':
            logger.info('OpenAI Realtime session created');
            break;

          case 'session.updated':
            logger.info('OpenAI Realtime session updated');
            break;

          case 'response.audio.delta':
            // Forward audio back to Twilio
            if (twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: session.streamSid,
                media: {
                  payload: event.delta // base64 audio
                }
              }));
            }
            break;

          case 'response.audio_transcript.done':
            logger.info(`AI said: ${event.transcript}`);
            session.conversationHistory.push({
              role: 'assistant',
              content: event.transcript
            });
            break;

          case 'conversation.item.input_audio_transcription.completed':
            logger.info(`User said: ${event.transcript}`);
            session.conversationHistory.push({
              role: 'user',
              content: event.transcript
            });
            break;

          case 'response.done':
            logger.info(`Response complete for call: ${session.callSid}`);
            break;

          case 'error':
            logger.error(`OpenAI Realtime error: ${JSON.stringify(event.error)}`);
            break;
        }
      } catch (error) {
        logger.error('Error processing OpenAI message:', error);
      }
    });

    openaiWs.on('close', () => {
      logger.info(`OpenAI Realtime disconnected for call: ${session.callSid}`);
    });

    openaiWs.on('error', (error) => {
      logger.error(`OpenAI Realtime error for call ${session.callSid}:`, error);
    });
  } catch (error) {
    logger.error('Failed to connect to OpenAI Realtime:', error);
  }
}

function sendTwilioMark(ws: WebSocket, streamSid: string, name: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name }
    }));
  }
}

async function getCallSession(callSid: string): Promise<any> {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(process.env.REDIS_URL!);
    const data = await redis.get(`call:${callSid}`);
    await redis.quit();
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error fetching call session from Redis:', error);
    return null;
  }
}

function cleanup(callSid: string) {
  const session = activeSessions.get(callSid);
  if (session) {
    if (session.openaiWs) {
      session.openaiWs.close();
    }
    activeSessions.delete(callSid);
    logger.info(`Cleaned up session for call: ${callSid}`);
  }
}

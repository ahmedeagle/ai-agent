
import WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { CallSessionManager } from '../managers/callSession';
import axios from 'axios';
import Redis from 'ioredis';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ADMIN_SERVICE_URL = `http://admin-service:${process.env.ADMIN_SERVICE_PORT || 3004}`;
const KB_SERVICE_URL = `http://knowledge-base-service:${process.env.KNOWLEDGE_BASE_PORT || 3008}`;

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant answering phone calls. Be friendly, professional, and concise. Greet callers warmly and help them with their needs.';

// Shared Redis client - avoids creating new connections per call
let sharedRedis: Redis | null = null;
function getRedisClient(): Redis {
  if (!sharedRedis || sharedRedis.status === 'end') {
    sharedRedis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: false
    });
    sharedRedis.on('error', (err) => logger.error('Shared Redis error:', err));
  }
  return sharedRedis;
}

interface StreamSession {
  callSid: string;
  streamSid?: string;
  agentId?: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: string; content: string }>;
  openaiWs?: WebSocket;
  twilioWs?: WebSocket;
  openaiReady: boolean;
  twilioReady: boolean;
  greetingSent: boolean;
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
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      conversationHistory: [],
      openaiReady: false,
      twilioReady: false,
      greetingSent: false,
      twilioWs: ws
    };
    activeSessions.set(callSid, session);

    // Load agent config first, then connect to OpenAI
    loadAgentConfig(session).then(() => {
      if (OPENAI_API_KEY) {
        connectOpenAIRealtime(session, ws, sessionManager);
      } else {
        logger.warn('No OPENAI_API_KEY set - voice AI will not function');
      }
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.event) {
          case 'connected':
            logger.info(`Media stream connected: ${callSid}`);
            break;

          case 'start':
            session.streamSid = msg.start?.streamSid;
            session.twilioReady = true;
            logger.info(`Media stream started, streamSid: ${session.streamSid}`);
            
            // Try to send greeting if OpenAI is also ready
            trySendGreeting(session);
            break;

          case 'media':
            // Forward audio to OpenAI Realtime API if connected
            if (session.openaiWs?.readyState === WebSocket.OPEN && session.openaiReady) {
              session.openaiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: msg.media.payload
              }));
            }
            break;

          case 'stop':
            logger.info(`Media stream stopped for call: ${callSid}`);
            cleanup(callSid, sessionManager);
            break;
        }
      } catch (error) {
        logger.error('Error processing media stream message:', error);
      }
    });

    ws.on('close', () => {
      logger.info(`Media stream WebSocket closed for call: ${callSid}`);
      cleanup(callSid, sessionManager);
    });

    ws.on('error', (error) => {
      logger.error(`Media stream WebSocket error for call ${callSid}:`, error);
      cleanup(callSid);
    });
  });

  logger.info('Twilio Media Stream WebSocket handler initialized');
}

async function loadAgentConfig(session: StreamSession) {
  try {
    const callData = await getCallSession(session.callSid);
    if (callData?.agentId) {
      session.agentId = callData.agentId;
      
      let companyId = callData.companyId || 'default-company';

      try {
        const res = await axios.get(`${ADMIN_SERVICE_URL}/agent/${callData.agentId}`);
        const agent = res.data?.data;
        if (agent?.systemPrompt) {
          session.systemPrompt = agent.systemPrompt;
          companyId = agent.companyId || companyId;
          logger.info(`Loaded agent config: ${agent.name}`);
        }
      } catch (e) {
        logger.warn('Could not fetch agent config, using default prompt');
      }

      // Fetch knowledge base context and inject into system prompt (RAG)
      try {
        const kbRes = await axios.get(`${KB_SERVICE_URL}/context/${companyId}`, {
          params: { limit: 15 },
          timeout: 5000
        });
        const kbContext = kbRes.data?.context;
        if (kbContext && kbContext.length > 0) {
          session.systemPrompt += `\n\n--- KNOWLEDGE BASE ---\nUse the following knowledge to answer questions accurately:\n\n${kbContext}\n--- END KNOWLEDGE BASE ---`;
          logger.info(`Injected KB context (${kbRes.data?.items || 0} items) into system prompt`);
        }
      } catch (e) {
        logger.warn('Could not fetch KB context (non-blocking)');
      }
    } else {
      logger.warn('No agent ID in call session, using default prompt');
    }
  } catch (error) {
    logger.error('Error loading agent config:', error);
  }
}

function trySendGreeting(session: StreamSession) {
  if (session.greetingSent || !session.openaiReady || !session.twilioReady) {
    return;
  }
  
  session.greetingSent = true;
  logger.info(`Sending initial greeting for call: ${session.callSid}`);
  
  if (session.openaiWs?.readyState === WebSocket.OPEN) {
    // Add a conversation item with the greeting instruction, then trigger response
    session.openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: 'Hello, I am calling in. Please greet me warmly and ask how you can help.'
        }]
      }
    }));
    session.openaiWs.send(JSON.stringify({
      type: 'response.create'
    }));
  }
}

function connectOpenAIRealtime(session: StreamSession, twilioWs: WebSocket, sessionManager: CallSessionManager) {
  try {
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
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
      
      // Configure session with system prompt and audio format
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: session.systemPrompt,
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

        // Log all event types for debugging
        if (event.type !== 'response.audio.delta' && event.type !== 'response.audio_transcript.delta') {
          logger.info(`OpenAI event: ${event.type}`);
        }

        switch (event.type) {
          case 'session.created':
            logger.info('OpenAI Realtime session created');
            break;

          case 'session.updated':
            logger.info('OpenAI Realtime session configured and ready');
            session.openaiReady = true;
            // Now try to send greeting (Twilio might already be ready)
            trySendGreeting(session);
            break;

          case 'input_audio_buffer.speech_started':
            // User started speaking — interrupt AI audio
            logger.info('User speaking - interrupting AI audio');
            // Clear Twilio's audio playback buffer so AI voice stops immediately
            if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
              session.twilioWs.send(JSON.stringify({
                event: 'clear',
                streamSid: session.streamSid
              }));
            }
            // Cancel current OpenAI response so it stops generating
            if (session.openaiWs?.readyState === WebSocket.OPEN) {
              session.openaiWs.send(JSON.stringify({
                type: 'response.cancel'
              }));
            }
            break;

          case 'input_audio_buffer.speech_stopped':
            logger.info('User stopped speaking');
            break;

          case 'input_audio_buffer.committed':
            logger.info('Audio buffer committed for transcription');
            break;

          case 'response.audio.delta':
            // Forward AI audio back to Twilio
            if (twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
              twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: session.streamSid,
                media: {
                  payload: event.delta
                }
              }));
            }
            break;

          case 'response.audio_transcript.delta':
            // Partial transcript - ignore but good to know it's happening
            break;

          case 'response.audio_transcript.done':
            logger.info(`AI said: ${event.transcript}`);
            session.conversationHistory.push({
              role: 'assistant',
              content: event.transcript
            });
            // Persist to session manager for transcript saving
            sessionManager.addTranscript(session.callSid, 'ai', event.transcript).catch(() => {});
            break;

          case 'response.text.delta':
            logger.info(`AI text delta: ${event.delta}`);
            break;

          case 'response.text.done':
            logger.info(`AI text response: ${event.text}`);
            break;

          case 'conversation.item.input_audio_transcription.completed':
            logger.info(`User said: ${event.transcript}`);
            session.conversationHistory.push({
              role: 'user',
              content: event.transcript
            });
            // Persist to session manager for transcript saving
            sessionManager.addTranscript(session.callSid, 'user', event.transcript).catch(() => {});
            break;

          case 'response.done':
            // Log the full response output to debug
            const output = event.response?.output;
            const statusDetails = event.response?.status_details;
            logger.info(`Response done. Status: ${event.response?.status}. Output items: ${output?.length || 0}`);
            if (event.response?.status === 'failed') {
              logger.error(`Response FAILED. Details: ${JSON.stringify(statusDetails)}`);
            }
            if (output && output.length > 0) {
              for (const item of output) {
                logger.info(`  Output item type: ${item.type}, role: ${item.role}, content types: ${item.content?.map((c: any) => c.type).join(', ') || 'none'}`);
              }
            }
            break;

          case 'response.output_item.added':
            logger.info(`Output item added: ${event.item?.type}`);
            break;

          case 'response.content_part.added':
            logger.info(`Content part added: ${event.part?.type}`);
            break;

          case 'error':
            logger.error(`OpenAI Realtime error: ${JSON.stringify(event.error)}`);
            break;

          default:
            // Log any unhandled events
            if (!event.type?.startsWith('rate_limits')) {
              logger.info(`Unhandled OpenAI event: ${event.type}`);
            }
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

async function getCallSession(callSid: string): Promise<any> {
  try {
    const redis = getRedisClient();
    const data = await redis.get(`call:${callSid}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error fetching call session from Redis:', error);
    return null;
  }
}

function cleanup(callSid: string, sessionManager?: CallSessionManager) {
  const session = activeSessions.get(callSid);
  if (session) {
    if (session.openaiWs) {
      session.openaiWs.close();
    }
    activeSessions.delete(callSid);
    logger.info(`Cleaned up session for call: ${callSid}`);
  }
}

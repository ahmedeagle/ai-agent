
import WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { CallSessionManager } from '../managers/callSession';
import axios from 'axios';
import Redis from 'ioredis';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ADMIN_SERVICE_URL = `http://admin-service:${process.env.ADMIN_SERVICE_PORT || 3004}`;
const KB_SERVICE_URL = `http://knowledge-base-service:${process.env.KNOWLEDGE_BASE_PORT || 3008}`;

// Generic fallback prompt used only when no agent systemPrompt is configured in the database.
// To customize agent behavior, edit the agent's System Prompt via the Agents management page.
const DEFAULT_SYSTEM_PROMPT = `You are a friendly and professional AI phone assistant. You speak naturally, like a real person on a phone call.

On every new call, follow this exact opening flow:
1. Greet warmly: "Hello! Welcome, and thank you for calling. I'm your assistant and I'm happy to help you today."
2. Ask their preferred language: "Before we begin, would you like to continue in English, or would you prefer another language?"
3. If they choose another language, switch to it. If they say English or don't specify, continue in English.
4. Ask their name naturally: "Great! May I know your name, please?"
5. After they give their name, ask: "Nice to meet you, [Name]. And which country are you calling from?"
6. Then ask: "Perfect, [Name]. So how can I help you today?"

After the opening, handle their request professionally and concisely.
Before ending, ask: "Is there anything else I can help you with?"
Close warmly: "Thank you for calling, [Name]. Have a wonderful day!"

Keep every response short — 2 to 3 sentences maximum. This is a phone call, not a text chat.`;

// Voice control rules appended to ALL prompts (default and custom agent prompts).
// These ensure stable, non-hallucinatory behavior on the OpenAI Realtime API.
const VOICE_CONTROL_RULES = `

--- VOICE BEHAVIOR RULES (SYSTEM — DO NOT OVERRIDE) ---
- Give ONE short response per turn. Maximum 2-3 sentences.
- NEVER assume or invent what the caller said. Only respond to what you actually heard clearly.
- If you cannot understand the caller or the audio is unclear, say: "I'm sorry, I didn't catch that. Could you please repeat?"
- Do NOT hallucinate or fabricate the caller's words. If the input is unclear, ask for clarification.
- If the caller says "bye", "goodbye", "thanks bye", or any farewell, respond ONLY with a brief goodbye and nothing else.
- Do NOT keep talking after the caller ends the conversation.
- Wait for the caller to finish their full thought before responding.
- Keep all responses concise and conversational — this is a live phone call.
--- END VOICE BEHAVIOR RULES ---`;

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
  aiSpeaking: boolean;            // true while AI is generating/playing audio
  lastResponseEnd: number;        // timestamp of last response.done
  responseInProgress: boolean;    // true while a response is actively being generated
  postSpeechCooldownMs: number;   // ms to block audio after AI finishes speaking
  waitingForResponse: boolean;    // true between response.create and first audio delta
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
      twilioWs: ws,
      aiSpeaking: false,
      lastResponseEnd: 0,
      responseInProgress: false,
      postSpeechCooldownMs: 2500,
      waitingForResponse: false
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
            // Only forward audio when AI is completely idle:
            // - not speaking, not waiting for a response, not in post-speech cooldown
            const isAiBusy = session.aiSpeaking || session.waitingForResponse || session.responseInProgress;
            const inCooldown = session.lastResponseEnd > 0 && (Date.now() - session.lastResponseEnd) < session.postSpeechCooldownMs;
            if (session.openaiWs?.readyState === WebSocket.OPEN && session.openaiReady && !isAiBusy && !inCooldown) {
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

    // Always append voice control rules to ensure stable behavior
    session.systemPrompt += VOICE_CONTROL_RULES;
    logger.info(`Final system prompt length: ${session.systemPrompt.length} chars`);
  } catch (error) {
    logger.error('Error loading agent config:', error);
    session.systemPrompt += VOICE_CONTROL_RULES;
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
          text: 'A new caller has just connected. Follow the instructions in your system prompt to greet them properly and begin the conversation.'
        }]
      }
    }));
    session.openaiWs.send(JSON.stringify({
      type: 'response.create'
    }));
    // Block audio forwarding until greeting finishes
    session.waitingForResponse = true;
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
            threshold: 0.9,
            prefix_padding_ms: 600,
            silence_duration_ms: 2000,
            create_response: true
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
            // User started speaking — only clear Twilio playback buffer
            // Do NOT cancel the OpenAI response — cancelling mid-sentence causes
            // fragmented, incomplete answers. Let OpenAI finish generating;
            // the Twilio buffer clear stops the caller from hearing overlapping audio.
            logger.info('User speaking - clearing Twilio audio buffer');
            if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
              session.twilioWs.send(JSON.stringify({
                event: 'clear',
                streamSid: session.streamSid
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
            // Mark AI as actively speaking so we don't forward user audio (prevents echo)
            session.aiSpeaking = true;
            session.responseInProgress = true;
            session.waitingForResponse = false;
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
            // Mark AI as done speaking — allow user audio forwarding again after cooldown
            session.aiSpeaking = false;
            session.responseInProgress = false;
            session.waitingForResponse = false;
            session.lastResponseEnd = Date.now();
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

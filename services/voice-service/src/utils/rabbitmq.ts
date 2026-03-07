import amqp from 'amqplib';
import { logger } from './logger';

let connection: amqp.Connection;
let channel: amqp.Channel;

export async function initRabbitMQ(): Promise<void> {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL!);
    channel = await connection.createChannel();

    // Declare exchanges
    await channel.assertExchange('call.events', 'topic', { durable: true });
    await channel.assertExchange('voice.events', 'topic', { durable: true });

    logger.info('RabbitMQ initialized');
  } catch (error) {
    logger.error('RabbitMQ initialization error:', error);
    throw error;
  }
}

export async function publishEvent(routingKey: string, data: any): Promise<void> {
  try {
    if (!channel) {
      await initRabbitMQ();
    }

    const exchange = routingKey.startsWith('call.') ? 'call.events' : 'voice.events';
    
    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
  } catch (error) {
    logger.error('Error publishing event:', error);
  }
}

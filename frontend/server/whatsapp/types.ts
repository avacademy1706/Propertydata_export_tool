/** Minimal subset of the WhatsApp Cloud API webhook payload we consume. */

export interface WhatsappMediaRef {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
}

export interface WhatsappInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WhatsappMediaRef;
  video?: WhatsappMediaRef;
  document?: WhatsappMediaRef;
  audio?: WhatsappMediaRef;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface WhatsappValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: WhatsappInboundMessage[];
  statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>;
}

export interface WhatsappWebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: Array<{ value?: WhatsappValue; field?: string }> }>;
}

export interface ParsedInbound {
  phoneNumberId?: string;
  senderWaId: string;
  senderName?: string;
  message: WhatsappInboundMessage;
}

export interface ParsedStatus {
  messageId: string;
  status: string;
}

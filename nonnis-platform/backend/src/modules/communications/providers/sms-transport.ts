/** Provider-independent SMS transport port. Twilio becomes an implementation of
 *  this interface in a later phase. No sending happens in 15A. */
export const SMS_TRANSPORT = Symbol("SMS_TRANSPORT");

export interface OutboundSms {
  to: string;
  body: string;
  from?: string;
}

export interface SmsSendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface SmsTransport {
  readonly name: string;
  send(message: OutboundSms): Promise<SmsSendResult>;
}

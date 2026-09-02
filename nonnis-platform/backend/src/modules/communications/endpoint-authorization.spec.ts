import "reflect-metadata";
import { PATH_METADATA } from "@nestjs/common/constants";
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from "../auth/decorators";
import { PERMISSIONS } from "../../common/rbac";

import { ContactsController } from "./contacts/contacts.controller";
import { ListsController } from "./lists/lists.controller";
import { TagsController } from "./tags/tags.controller";
import { SuppressionsController } from "./suppressions/suppressions.controller";
import { ImportsController } from "./imports/imports.controller";
import { EmailTemplatesController } from "./email/email-templates.controller";
import { EmailCampaignsController } from "./email/email-campaigns.controller";
import { EmailStatusController } from "./email/email-status.controller";
import { ConversationsController } from "./email/conversations.controller";
import { InboundReviewController } from "./email/inbound-review.controller";
import { EmailWebhookController } from "./email/email-webhook.controller";
import { EmailInboundWebhookController } from "./email/email-inbound-webhook.controller";
import { UnsubscribeController } from "./email/unsubscribe.controller";
import { SmsTemplatesController } from "./sms/sms-templates.controller";
import { SmsCampaignsController } from "./sms/sms-campaigns.controller";
import { SmsStatusController } from "./sms/sms-status.controller";
import { SmsWebhookController } from "./sms/sms-webhook.controller";
import { CommunicationsOperationsController } from "./operations/communications-operations.controller";

/** Controllers whose routes are deliberately public (provider webhooks + unsubscribe). */
const PUBLIC_CONTROLLERS = [EmailWebhookController, EmailInboundWebhookController, SmsWebhookController, UnsubscribeController];

const AUTHENTICATED_CONTROLLERS = [
  ContactsController, ListsController, TagsController, SuppressionsController, ImportsController,
  EmailTemplatesController, EmailCampaignsController, EmailStatusController, ConversationsController,
  InboundReviewController, SmsTemplatesController, SmsCampaignsController, SmsStatusController,
  CommunicationsOperationsController,
];

const COMMUNICATIONS_PERMISSIONS = new Set<string>([
  PERMISSIONS.COMMUNICATIONS_READ,
  PERMISSIONS.COMMUNICATIONS_MANAGE,
  PERMISSIONS.COMMUNICATIONS_IMPORT,
  PERMISSIONS.COMMUNICATIONS_SEND,
]);

type Ctor = new (...args: never[]) => object;

/** Read a prototype method without fighting the class's declared shape. */
function method(controller: Ctor, name: string): object {
  return (controller.prototype as unknown as Record<string, object>)[name]!;
}

/** Every route-handling method on a controller prototype. */
function handlers(controller: Ctor): string[] {
  const proto = controller.prototype as unknown as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).filter((name) => {
    if (name === "constructor") return false;
    const fn = proto[name];
    return typeof fn === "function" && Reflect.hasMetadata(PATH_METADATA, fn as object);
  });
}

/**
 * Structural authorization guarantee. Navigation is not authorization: this asserts
 * that EVERY communications endpoint is either explicitly public (a provider webhook
 * or the public unsubscribe page) or gated behind a communications permission — so a
 * new endpoint cannot be added unprotected by accident.
 */
describe("communications endpoint authorization", () => {
  it("finds route handlers on every controller (the reflection itself works)", () => {
    for (const controller of [...AUTHENTICATED_CONTROLLERS, ...PUBLIC_CONTROLLERS]) {
      expect(handlers(controller).length).toBeGreaterThan(0);
    }
  });

  it("guards every authenticated endpoint with a communications permission", () => {
    for (const controller of AUTHENTICATED_CONTROLLERS) {
      for (const handler of handlers(controller)) {
        const fn = method(controller, handler);
        const required: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn) ?? [];
        const anyOf: string[] = Reflect.getMetadata(ANY_PERMISSIONS_KEY, fn) ?? [];
        const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, fn) === true;
        const declared = [...required, ...anyOf];

        expect({ controller: controller.name, handler, isPublic }).toMatchObject({ isPublic: false });
        expect({ controller: controller.name, handler, declared }).toEqual(
          expect.objectContaining({ declared: expect.arrayContaining([expect.any(String)]) }),
        );
        for (const permission of declared) {
          expect(COMMUNICATIONS_PERMISSIONS.has(permission)).toBe(true);
        }
      }
    }
  });

  it("marks provider webhooks and public unsubscribe explicitly public", () => {
    for (const controller of PUBLIC_CONTROLLERS) {
      for (const handler of handlers(controller)) {
        const fn = method(controller, handler);
        expect({ controller: controller.name, handler, isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, fn) === true }).toMatchObject({ isPublic: true });
      }
    }
  });

  it("requires send permission for every path that can dispatch a message", () => {
    const sendPaths: Array<[Ctor, string]> = [
      [EmailTemplatesController, "testSend"],
      [EmailCampaignsController, "queue"],
      [EmailCampaignsController, "cancel"],
      [SmsTemplatesController, "test"],
      [SmsCampaignsController, "queue"],
      [SmsCampaignsController, "cancel"],
      [ConversationsController, "reply"],
      [ConversationsController, "retry"],
      [ConversationsController, "uploadUrl"],
      [CommunicationsOperationsController, "retry"],
    ];
    for (const [controller, handler] of sendPaths) {
      const fn = method(controller, handler);
      const required: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn) ?? [];
      expect({ controller: controller.name, handler, required }).toMatchObject({ required: [PERMISSIONS.COMMUNICATIONS_SEND] });
    }
  });

  it("keeps operational health behind manage permission", () => {
    const fn = method(CommunicationsOperationsController, "health");
    expect(Reflect.getMetadata(PERMISSIONS_KEY, fn)).toEqual([PERMISSIONS.COMMUNICATIONS_MANAGE]);
  });
});

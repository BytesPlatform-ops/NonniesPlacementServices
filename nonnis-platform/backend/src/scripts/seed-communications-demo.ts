/**
 * Idempotent DEMO seed for Communications (Phases 15A + 15B + 15D).
 *
 *   npm run seed:communications-demo            # (re)create demo contacts + email/SMS templates
 *   npm run seed:communications-demo -- --clean # remove them
 *
 * All records are clearly FICTIONAL (no real people, no patient/PHI data). Demo
 * records are grouped under names starting "Demo — …" so they are easy to remove.
 * The seeded email campaign is a DRAFT only — nothing is ever queued or sent.
 */
import { PrismaClient, type CommunicationConsentStatus, type Prisma } from "@prisma/client";
import { toEmailValue, toPhoneValue } from "../modules/communications/normalization";
import { compileDesign } from "../modules/communications/email/email-compiler";
import { validateDesign, type Block, type EmailDesign } from "../modules/communications/email/template-design";
import { validateSmsBody } from "../modules/communications/sms/sms-merge";

const prisma = new PrismaClient();
const LIST_PREFIX = "Demo — ";

async function clean(): Promise<void> {
  // Campaigns first (recipients cascade), then templates, then contacts/lists/tags.
  await prisma.communicationEmailCampaign.deleteMany({ where: { name: { startsWith: LIST_PREFIX } } });
  await prisma.communicationEmailTemplate.deleteMany({ where: { name: { startsWith: LIST_PREFIX } } });
  await prisma.communicationSmsCampaign.deleteMany({ where: { name: { startsWith: LIST_PREFIX } } });
  await prisma.communicationSmsTemplate.deleteMany({ where: { name: { startsWith: LIST_PREFIX } } });
  const demoLists = await prisma.communicationList.findMany({ where: { name: { startsWith: LIST_PREFIX } }, select: { id: true } });
  const memberIds = (await prisma.communicationListMember.findMany({ where: { listId: { in: demoLists.map((l) => l.id) } }, select: { contactId: true } })).map((m) => m.contactId);
  const c = await prisma.communicationContact.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.communicationList.deleteMany({ where: { name: { startsWith: LIST_PREFIX } } });
  await prisma.communicationTag.deleteMany({ where: { name: { startsWith: "demo-" } } });
  await prisma.communicationSuppression.deleteMany({ where: { source: "Demo seed" } });
  console.log(`Removed ${c.count} demo contact(s) and demo lists/tags/suppressions/templates/campaigns.`);
}

const DESIGN_SETTINGS: EmailDesign["settings"] = {
  backgroundColor: "#f5f1ea",
  contentBackgroundColor: "#ffffff",
  contentWidth: 600,
  textColor: "#3b352f",
  linkColor: "#8a5a2b",
  fontFamily: "Georgia, 'Times New Roman', serif",
};

function buildDesign(blocks: Block[]): EmailDesign {
  return { version: 1, settings: DESIGN_SETTINGS, blocks };
}

interface TemplateSpec {
  name: string;
  description: string;
  subject: string;
  preheader: string;
  blocks: Block[];
}

const TEMPLATE_SPECS: TemplateSpec[] = [
  {
    name: "Demo — Welcome",
    description: "Friendly welcome note for new partner contacts.",
    subject: "Welcome to Nonni's, {{firstName}}",
    preheader: "We're glad to partner with you.",
    blocks: [
      { id: "t1-h", type: "heading", content: "Welcome, {{firstName}}!", level: 1, align: "left" },
      { id: "t1-p1", type: "text", content: "Thank you for connecting with Nonni's. We help families find the right residential placement with care and clarity.", align: "left" },
      { id: "t1-p2", type: "text", content: "Reach out any time — we're here to help {{organizationName}} however we can.", align: "left" },
      { id: "t1-btn", type: "button", label: "Visit our site", href: "https://www.example.com", align: "left", backgroundColor: "#8a5a2b", textColor: "#ffffff", radius: 6 },
    ],
  },
  {
    name: "Demo — Newsletter",
    description: "Simple monthly update layout.",
    subject: "Nonni's monthly update",
    preheader: "A few things worth sharing this month.",
    blocks: [
      { id: "t2-h", type: "heading", content: "This month at Nonni's", level: 2, align: "left" },
      { id: "t2-p1", type: "text", content: "Hello {{firstName}}, here's a short update on our placement work and community partners.", align: "left" },
      { id: "t2-d", type: "divider" },
      { id: "t2-p2", type: "text", content: "As always, thank you for being part of what we do. Warm regards, the Nonni's team.", align: "left" },
    ],
  },
];

async function seedEmailTemplates(newsletterListId: string): Promise<void> {
  let firstTemplateId: string | null = null;
  for (const spec of TEMPLATE_SPECS) {
    const design = validateDesign(buildDesign(spec.blocks), false);
    const { html, text } = compileDesign(design, { preheader: spec.preheader });
    const template = await prisma.communicationEmailTemplate.create({
      data: {
        name: spec.name,
        description: spec.description,
        subjectDefault: spec.subject,
        preheaderDefault: spec.preheader,
        designJson: buildDesign(spec.blocks) as unknown as Prisma.InputJsonValue,
        compiledHtml: html,
        compiledText: text,
        status: "ACTIVE",
      },
    });
    firstTemplateId ??= template.id;
  }

  // One DRAFT campaign only — never queued or sent by the seed.
  await prisma.communicationEmailCampaign.create({
    data: {
      name: "Demo — Newsletter draft",
      status: "DRAFT",
      templateId: firstTemplateId,
      audienceConfig: { listIds: [newsletterListId], contactIds: [] } as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Seeded ${TEMPLATE_SPECS.length} email template(s) and 1 draft campaign.`);
}

/**
 * Demo SMS templates (15D). Plain text with safe contact merge fields only —
 * deliberately short so they stay a single GSM-7 segment. The seeded SMS campaign
 * is a DRAFT: nothing is ever queued or sent.
 */
const SMS_TEMPLATE_SPECS = [
  {
    name: "Demo — Appointment reminder",
    description: "Short single-segment reminder.",
    body: "Hi {{firstName}}, this is a reminder from Nonni's Placement about your upcoming appointment. Reply STOP to opt out.",
  },
  {
    name: "Demo — Placement update",
    description: "Brief status update for partner contacts.",
    body: "Hi {{firstName}}, we have an update on your placement request. A member of our team will call you today.",
  },
];

async function seedSmsTemplates(newsletterListId: string): Promise<void> {
  let firstTemplateId: string | null = null;
  for (const spec of SMS_TEMPLATE_SPECS) {
    const body = validateSmsBody(spec.body);
    const template = await prisma.communicationSmsTemplate.create({
      data: { name: spec.name, description: spec.description, body, status: "ACTIVE" },
    });
    firstTemplateId ??= template.id;
  }

  await prisma.communicationSmsCampaign.create({
    data: {
      name: "Demo — SMS reminder draft",
      status: "DRAFT",
      templateId: firstTemplateId,
      audienceConfig: { listIds: [newsletterListId], contactIds: [] } as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`Seeded ${SMS_TEMPLATE_SPECS.length} SMS template(s) and 1 draft SMS campaign.`);
}

interface Spec {
  first?: string;
  last?: string;
  email?: string;
  phone?: string;
  org?: string;
  emailConsent?: CommunicationConsentStatus;
  smsConsent?: CommunicationConsentStatus;
  lists: number[]; // indexes into LISTS
  tags: string[];
}

const LISTS = ["Demo — Hospital Outreach", "Demo — Newsletter"];

const SPECS: Spec[] = [
  { first: "Ada", last: "Reyes", email: "ada.reyes@demo.test", phone: "+1 415 555 0161", org: "Demo Health Partners", emailConsent: "OPTED_IN", smsConsent: "OPTED_IN", lists: [0, 1], tags: ["demo-vip"] },
  { first: "Ben", last: "Okafor", email: "ben.okafor@demo.test", emailConsent: "OPTED_IN", lists: [1], tags: ["demo-partner"] },
  { first: "Cara", last: "Nguyen", phone: "+1 206 555 0132", smsConsent: "OPTED_IN", lists: [0], tags: [] },
  { first: "Dan", last: "Mostoller", email: "dan.m@demo.test", phone: "+1 312 555 0155", lists: [0], tags: ["demo-vip"] },
  { first: "Eve", last: "Larsson", email: "eve.larsson@demo.test", emailConsent: "OPTED_OUT", lists: [1], tags: [] },
  { first: "Finn", last: "Doyle", phone: "+1 503 555 0176", smsConsent: "OPTED_OUT", lists: [0], tags: [] },
  { first: "Gia", last: "Romano", email: "gia.romano@demo.test", emailConsent: "UNKNOWN", lists: [1], tags: ["demo-partner"] },
  { first: "Hugo", last: "Weiss", email: "hugo.weiss@demo.test", phone: "+1 617 555 0188", org: "Demo Senior Care", emailConsent: "OPTED_IN", smsConsent: "UNKNOWN", lists: [0, 1], tags: [] },
  { first: "Ivy", last: "Park", email: "ivy.park@demo.test", org: "Demo Rehab Group", lists: [1], tags: ["demo-vip"] },
  { first: "Jon", last: "Feld", phone: "+1 646 555 0110", org: "Demo Home Care", lists: [0], tags: [] },
  { first: "Kai", last: "Winters", email: "kai.winters@demo.test", emailConsent: "OPTED_IN", lists: [1], tags: [] },
  { first: "Lena", last: "Sato", email: "lena.sato@demo.test", phone: "+1 213 555 0143", emailConsent: "OPTED_IN", smsConsent: "OPTED_IN", lists: [0], tags: ["demo-partner"] },
  { first: "Mara", last: "Costa", email: "mara.costa@demo.test", org: "Demo Placement Co", emailConsent: "UNKNOWN", lists: [1], tags: [] },
  { first: "Nate", last: "Boone", phone: "+1 305 555 0129", smsConsent: "UNKNOWN", lists: [0], tags: [] },
  // These two are also seeded into suppression below.
  { first: "Opal", last: "Frank", email: "opal.frank@demo.test", emailConsent: "OPTED_OUT", lists: [1], tags: [] },
  { first: "Pax", last: "Ryan", phone: "+1 425 555 0117", smsConsent: "OPTED_OUT", lists: [0], tags: [] },
];

async function main(): Promise<void> {
  if (process.argv.includes("--clean")) {
    await clean();
    return;
  }
  await clean(); // idempotent refresh

  const lists = await Promise.all(LISTS.map((name) => prisma.communicationList.create({ data: { name } })));

  let created = 0;
  const now = new Date();
  for (const s of SPECS) {
    const email = s.email ? toEmailValue(s.email) : null;
    const phone = s.phone ? toPhoneValue(s.phone, "US") : null;
    if (!email && !phone) {
      console.warn(`Skipped ${s.first} ${s.last}: no valid channel (phone parse failed?)`);
      continue;
    }
    const contact = await prisma.communicationContact.create({
      data: {
        firstName: s.first ?? null,
        lastName: s.last ?? null,
        email: email?.display ?? null,
        normalizedEmail: email?.normalized ?? null,
        phone: phone?.display ?? null,
        normalizedPhoneE164: phone?.e164 ?? null,
        organizationName: s.org ?? null,
        source: "MANUAL",
        preferences: {
          create: [
            ...(email ? [{ channel: "EMAIL" as const, consentStatus: s.emailConsent ?? "UNKNOWN", consentAt: s.emailConsent === "OPTED_IN" ? now : null, optOutAt: s.emailConsent === "OPTED_OUT" ? now : null }] : []),
            ...(phone ? [{ channel: "SMS" as const, consentStatus: s.smsConsent ?? "UNKNOWN", consentAt: s.smsConsent === "OPTED_IN" ? now : null, optOutAt: s.smsConsent === "OPTED_OUT" ? now : null }] : []),
          ],
        },
        listMemberships: { create: s.lists.map((i) => ({ listId: lists[i].id })) },
        tagAssignments: {
          create: await Promise.all(
            s.tags.map(async (name) => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } })),
          ),
        },
      },
    });
    created++;
    // Suppress the two designated demo addresses.
    if (s.email === "opal.frank@demo.test" && email) {
      await prisma.communicationSuppression.create({ data: { channel: "EMAIL", normalizedAddress: email.normalized, reason: "USER_OPT_OUT", source: "Demo seed" } });
    }
    if (s.phone === "+1 425 555 0117" && phone) {
      await prisma.communicationSuppression.create({ data: { channel: "SMS", normalizedAddress: phone.e164, reason: "USER_OPT_OUT", source: "Demo seed" } });
    }
    void contact;
  }
  console.log(`Seeded ${created} demo contact(s), ${lists.length} lists, tags, and 2 suppressions.`);

  await seedEmailTemplates(lists[1].id);
  await seedSmsTemplates(lists[0].id);
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

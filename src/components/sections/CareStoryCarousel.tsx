import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Slide } from "@/components/media/VIPVideoCarousel";
import { FannedGallery } from "@/components/gallery/FannedGallery";

const NEW = "/assets/new";

// Home slides — bed/care media from the user's `new/` folder (warm umber/bronze brand).
const HOME_SLIDES: Slide[] = [
  { type: "video", src: `${NEW}/hd-8944262.mp4`, poster: `${NEW}/pexels-babydov-7789647.jpg`, eyebrow: "Care moments", caption: "RN-reviewed care moments", sub: "A nurse's review on every referral" },
  { type: "image", src: `${NEW}/pexels-babydov-7789609.jpg`, eyebrow: "Availability", caption: "Beds matched to real needs", sub: "Care level, funding & location" },
  { type: "video", src: `${NEW}/hd-6011438.mp4`, poster: `${NEW}/pexels-fernando-capetillo-94107723-38167593.jpg`, eyebrow: "Guidance", caption: "Families guided with clarity", sub: "Calm, jargon-free support" },
  { type: "image", src: `${NEW}/pexels-fernando-capetillo-94107723-38167593.jpg`, eyebrow: "Provider spaces", caption: "Provider spaces, ready faster", sub: "Verified, RN-reviewed listings" },
  { type: "video", src: `${NEW}/hd-7522352.mp4`, poster: `${NEW}/pexels-timothy-huliselan-205951426-12081340.jpg`, eyebrow: "Follow-up", caption: "Care that continues after move-in", sub: "Up to 45 days of RN case management" },
  { type: "image", src: `${NEW}/pexels-printexstar-11660581.jpg`, eyebrow: "Real availability", caption: "Real care, real availability", sub: "Live openings across Washington" },
  { type: "image", src: `${NEW}/pexels-timothy-huliselan-205951426-12081340.jpg`, eyebrow: "Placement", caption: "From search to placement", sub: "Coordinated end to end" },
  { type: "video", src: `${NEW}/12925561_1920_1080_24fps.mp4`, poster: `${NEW}/pexels-babydov-7789609.jpg`, eyebrow: "Washington", caption: "Support across Washington", sub: "39 counties, one network" },
];

export function CareStoryCarousel({
  slides = HOME_SLIDES,
  eyebrow = "In their world",
  title = "Care you can see, not just read about",
  description = "The people, communities, and beds Nonni's connects — every day.",
  tone = "ice",
}: {
  slides?: Slide[];
  eyebrow?: string;
  title?: string;
  description?: string;
  tone?: "light" | "ice" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <Section id="care-story" tone={dark ? "dark" : "ice"} density="dense">
      <SectionHeading eyebrow={eyebrow} tone={dark ? "dark" : "light"} title={title} description={description} align="center" className="mx-auto" />
      <div className="mt-8">
        <FannedGallery slides={slides} />
      </div>
    </Section>
  );
}

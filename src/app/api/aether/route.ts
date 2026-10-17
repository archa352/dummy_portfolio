// Local stand-in for the source page's hosted AI agent. Answers use the source's
// "title | short | long | media | CTA" format and only restate copy shown on the page.

type Topic = { keywords: string[]; answer: string };

const topics: Topic[] = [
  {
    keywords: ["sound", "audio", "quality", "music", "bass", "noise", "anc", "equalizer"],
    answer:
      "Unrivalled audio quality | Experience every note as if it were born in silence. | Aether 1 is tuned for sound without boundaries: high resolution microphones, active noise control and an equalizer shape the experience so every note feels like it was born in silence. | IMAGE_SOUND | CTA_4",
  },
  {
    keywords: ["design", "material", "craft", "build", "look", "case", "clarity"],
    answer:
      "Crafted for pure clarity | Meticulous future forward design & materials. | Every surface of Aether 1, from the glass shell to the silicone tips and the charging case, is crafted for pure clarity with meticulous, future forward design and materials. | IMAGE_CRAFT | CTA_1",
  },
  {
    keywords: ["control", "touch", "volume", "haptic", "button", "gesture", "mic"],
    answer:
      "Intuitive controls | Haptic feedback and intuitive controls for all environments. | A play-state touch pad, haptic volume controls and ANC & microphone controls sit right on the earbud, giving tactile feedback in every environment. | IMAGE_CONTROLS | CTA_4",
  },
  {
    keywords: ["battery", "power", "charge", "charging", "core", "energy", "last"],
    answer:
      "Sub Alphatonic Power Core | Its energy, eternal. No charging, no constraints. | The Sub Alphatonic Power Core, wrapped in an acoustic dampening shell around the emission core, is presented as energy that never needs charging. | IMAGE_POWER | CTA_4",
  },
  {
    keywords: ["price", "buy", "order", "preorder", "cost", "ship", "purchase"],
    answer:
      "Preorder | Aether 1 is open for preorder. | Visit the preorder page to reserve your Aether 1 earbuds and follow the latest availability details. | IMAGE_PREORDER | CTA_3",
  },
  {
    keywords: ["spec", "specs", "weight", "size", "bluetooth", "waterproof", "ipx", "heart"],
    answer:
      "Specifications | Every detail of Aether 1 is listed on the specs page. | Highlights shown in the experience include IPX water resistance, a heart rate monitor, a spectrum visualiser, a custom chip and rotary diffusion discs. The full sheet lives on the specs page. | IMAGE_SPECS | CTA_1",
  },
  {
    keywords: ["who", "made", "brand", "offbrand", "off+brand", "agency", "contact"],
    answer:
      "Made by OFF+BRAND. | Aether 1 is a web experience crafted by OFF+BRAND. | The Aether 1 experience was designed and built by the OFF+BRAND. studio. Reach out to them to talk about your own project. | IMAGE_BRAND | CTA_2",
  },
];

const fallback =
  "Sound without boundaries | Aether 1 elevates your senses through timeless resonance. | Ask about sound, design, controls, the power core, specs or preorder and I will guide you through Aether 1. | IMAGE_DEFAULT | CTA_4";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.toLowerCase() : "";
  const match = topics.find((topic) => topic.keywords.some((keyword) => question.includes(keyword)));
  await new Promise((resolve) => setTimeout(resolve, 900));
  return Response.json({ answer: match?.answer ?? fallback });
}

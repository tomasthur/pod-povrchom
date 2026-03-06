 "use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

type RecognizeArgs = {
  audioBase64: string;
  mimeType: string;
  numOptions: number;
};

type RecognizeResult = {
  transcript: string;
  choiceIndex: number | null;
};

// What the user can say after "možnosť" to pick option N
const CHOICE_AFTER_MOZNOST: { index: number; words: string[] }[] = [
  { index: 0, words: ["a", "1", "jedna", "jednicka", "jednicku", "prvu", "prva"] },
  { index: 1, words: ["b", "be", "2", "dva", "dvojka", "dvojku", "druhu", "druha"] },
  { index: 2, words: ["c", "ce", "3", "tri", "trojka", "trojku", "tretiu", "tretia"] },
  { index: 3, words: ["d", "de", "4", "styri", "stvorka", "stvorku", "stvrtu", "stvrta"] },
  { index: 4, words: ["e", "5", "pat", "patka", "patku", "piatu", "piata"] },
  { index: 5, words: ["f", "ef", "6", "sest", "sestka", "sestku", "siestu", "siesta"] },
];

// Standalone words (without "možnosť" prefix) — excludes "a" to avoid Slovak conjunction false positive
const STANDALONE_VARIANTS: { index: number; words: string[] }[] = [
  { index: 0, words: ["jedna", "jednicka", "prva", "prvu", "prvy", "1"] },
  { index: 1, words: ["b", "be", "dva", "dvojka", "druha", "druhu", "druhy", "2"] },
  { index: 2, words: ["c", "ce", "tri", "trojka", "tretia", "tretiu", "treti", "3"] },
  { index: 3, words: ["d", "de", "styri", "stvorka", "stvrta", "stvrtu", "4"] },
  { index: 4, words: ["e", "pat", "patka", "piata", "piatu", "5"] },
  { index: 5, words: ["f", "ef", "sest", "sestka", "siesta", "siestu", "6"] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mapTranscriptToChoice(
  transcript: string,
  numOptions: number
): number | null {
  const text = normalize(transcript);
  const words = text.replace(/[.,!?]/g, " ").split(/\s+/).filter(Boolean);
  const maxIndex = Math.min(numOptions, 6) - 1;

  // 1) "moznost A/1/jedna" — highest priority, unambiguous
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].startsWith("moznost")) {
      const next = words[i + 1];
      for (const { index, words: w } of CHOICE_AFTER_MOZNOST) {
        if (index > maxIndex) continue;
        if (w.includes(next)) return index;
      }
    }
  }

  // 2) "pismeno A/B/C"
  const baseLetters = ["a", "b", "c", "d", "e", "f"];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].startsWith("pismen")) {
      const idx = baseLetters.indexOf(words[i + 1]);
      if (idx >= 0 && idx <= maxIndex) return idx;
    }
  }

  // 3) Standalone word match (no "a" to avoid conjunction collisions)
  for (const w of words) {
    for (const { index, words: variants } of STANDALONE_VARIANTS) {
      if (index > maxIndex) continue;
      if (variants.includes(w)) return index;
    }
  }

  return null;
}

export const recognizeVoiceChoice = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    numOptions: v.number(),
  },
  handler: async (ctx, args: RecognizeArgs): Promise<RecognizeResult> => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;

      if (!apiKey) {
        console.error("[voice] Missing DEEPGRAM_API_KEY in Convex env");
        return {
          transcript: "",
          choiceIndex: null,
        };
      }

      const audioBuffer = Buffer.from(args.audioBase64, "base64");

      // Nova-3: better Slovak recognition. Keyterms boost A–F + Slovak numbers.
      const keyterms = [
        "možnosť",
        "a", "b", "c", "d", "e", "f",
        "jedna", "dva", "tri", "štyri", "päť", "šesť",
        "prvá", "druhá", "tretia", "štvrtá", "piata", "šiesta",
        "jednička", "dvojka", "trojka", "štvorka", "päťka", "šestka",
      ];
      const keytermParams = keyterms.map((k) => `keyterm=${encodeURIComponent(k)}`).join("&");
      const url = `https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=sk&${keytermParams}`;

      const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": args.mimeType || "audio/m4a",
          },
          body: audioBuffer,
        }
      );

      if (!response.ok) {
        const body = await response.text();
        console.error(
          "[voice] Deepgram error",
          response.status,
          response.statusText,
          body.slice(0, 200)
        );
        return {
          transcript: "",
          choiceIndex: null,
        };
      }

      const json: any = await response.json();
      const transcript: string =
        json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

      const choiceIndex = mapTranscriptToChoice(transcript, args.numOptions);

      return {
        transcript,
        choiceIndex,
      };
    } catch (error) {
      console.error("[voice] Unexpected error talking to Deepgram", error);
      return {
        transcript: "",
        choiceIndex: null,
      };
    }
  },
});


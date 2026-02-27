import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Insert one podcast from a single JSON payload (e.g. from Supabase Storage URLs).
 * You send one object with all audio URLs; no need to send URL for every file separately.
 *
 * Example payload shape (paste your real URLs):
 * {
 *   title: "Pod povrchom Ep. 01",
 *   description: "...",
 *   introAudioUrl: "https://.../intro.mp3",
 *   accusationIntroAudioUrl: "https://.../accusation/intro.mp3",
 *   resultCorrectAudioUrl: "https://.../result/correct.mp3",
 *   resultWrongAudioUrl: "https://.../result/wrong.mp3",
 *   mainBranches: [
 *     { title: "Body", introAudioUrl: "https://.../main/body/intro.mp3", choices: [
 *       { title: "Thread", audioUrl: "https://.../main/body/choices/thread.mp3" },
 *       ...
 *     ]},
 *     ...
 *   ],
 *   accusations: [
 *     { suspectName: "Partner", audioUrl: "https://.../accusation/partner.mp3", isCorrect: false },
 *     { suspectName: "Colleague", audioUrl: "https://.../accusation/colleague.mp3", isCorrect: true },
 *     ...
 *   ]
 * }
 */
export const insertPodcastFromUrls = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    introAudioUrl: v.string(),
    accusationIntroAudioUrl: v.optional(v.string()),
    resultCorrectAudioUrl: v.optional(v.string()),
    resultWrongAudioUrl: v.optional(v.string()),
    mainBranches: v.array(
      v.object({
        title: v.string(),
        introAudioUrl: v.string(),
        choices: v.array(
          v.object({
            title: v.string(),
            audioUrl: v.string(),
          })
        ),
      })
    ),
    accusations: v.array(
      v.object({
        suspectName: v.string(),
        audioUrl: v.string(),
        isCorrect: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const podcastId = await ctx.db.insert("podcasts", {
      title: args.title,
      description: args.description,
      introAudioUrl: args.introAudioUrl,
      accusationIntroAudioUrl: args.accusationIntroAudioUrl,
      resultCorrectAudioUrl: args.resultCorrectAudioUrl,
      resultWrongAudioUrl: args.resultWrongAudioUrl,
    });

    const mainBranchIds: Id<"mainBranches">[] = [];

    for (const main of args.mainBranches) {
      const mainBranchId = await ctx.db.insert("mainBranches", {
        podcastId,
        title: main.title,
        introAudioUrl: main.introAudioUrl,
      });
      mainBranchIds.push(mainBranchId);
    }

    for (let mainIndex = 0; mainIndex < args.mainBranches.length; mainIndex++) {
      const main = args.mainBranches[mainIndex];
      const mainBranchId = mainBranchIds[mainIndex];
      for (const choice of main.choices) {
        await ctx.db.insert("subBranches", {
          mainBranchId,
          title: choice.title,
          audioUrl: choice.audioUrl,
        });
      }
    }

    for (const acc of args.accusations) {
      await ctx.db.insert("accusations", {
        podcastId,
        suspectName: acc.suspectName,
        audioUrl: acc.audioUrl,
        isCorrect: acc.isCorrect,
      });
    }

    return podcastId;
  },
});

export const seedTestPodcast = mutation({
  args: {},
  handler: async (ctx) => {
    // 1) Create podcast
    const podcastId = await ctx.db.insert("podcasts", {
      title: "Test Investigation",
      description: "Seed data for engine testing",
      introAudioUrl: "https://example.com/intro.mp3",
    });

    // 2) Create 4 main branches
    const mainBranchTitles = [
      "Body",
      "Digital Trace",
      "External Evidence",
      "Social Circle",
    ];

    const mainBranchIds: Id<"mainBranches">[] = [];

    for (const title of mainBranchTitles) {
      const mainBranchId = await ctx.db.insert("mainBranches", {
        podcastId,
        title,
        introAudioUrl: `https://example.com/main/${title.toLowerCase().replace(" ", "-")}-intro.mp3`,
      });
      mainBranchIds.push(mainBranchId);
    }

    // 3) Create 3 sub branches for each main branch
    const subBranchTitles = ["Sub 1", "Sub 2", "Sub 3"];

    for (let mainIndex = 0; mainIndex < mainBranchIds.length; mainIndex++) {
      const mainBranchId = mainBranchIds[mainIndex];
      const mainBranchTitle = mainBranchTitles[mainIndex];
      
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("subBranches", {
          mainBranchId,
          title: `${mainBranchTitle} - ${subBranchTitles[i]}`,
          audioUrl: `https://example.com/sub/${mainBranchId}/${i + 1}.mp3`,
        });
      }
    }

    // 4) Create 3 accusations
    const accusations = [
      { suspectName: "Suspect A", isCorrect: false },
      { suspectName: "Suspect B", isCorrect: true },
      { suspectName: "Suspect C", isCorrect: false },
    ];

    for (const accusation of accusations) {
      await ctx.db.insert("accusations", {
        podcastId,
        suspectName: accusation.suspectName,
        audioUrl: `https://example.com/accusation/${accusation.suspectName.toLowerCase().replace(" ", "-")}.mp3`,
        isCorrect: accusation.isCorrect,
      });
    }

    return podcastId;
  },
});

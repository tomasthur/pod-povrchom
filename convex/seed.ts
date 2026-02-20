import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

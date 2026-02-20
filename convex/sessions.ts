import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session;
  },
});

export const createSession = mutation({
  args: {
    podcastId: v.id("podcasts"),
  },
  handler: async (ctx, args) => {
    const podcast = await ctx.db.get(args.podcastId);
    if (podcast === null) {
      throw new Error("Podcast not found");
    }

    const sessionId = await ctx.db.insert("sessions", {
      podcastId: args.podcastId,
      selectedMainBranches: [],
      selectedSubBranches: {},
      currentState: "INTRO",
    });

    return sessionId;
  },
});

export const selectMainBranch = mutation({
  args: {
    sessionId: v.id("sessions"),
    mainBranchId: v.id("mainBranches"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }

    const mainBranch = await ctx.db.get(args.mainBranchId);
    if (mainBranch === null) {
      throw new Error("Main branch not found");
    }
    if (mainBranch.podcastId !== session.podcastId) {
      throw new Error("Main branch does not belong to the session's podcast");
    }

    const podcastMainBranches = await ctx.db
      .query("mainBranches")
      .withIndex("by_podcast", (q) => q.eq("podcastId", session.podcastId))
      .collect();
    const totalMainBranches = podcastMainBranches.length;
    const maxSelectableMain = Math.floor(totalMainBranches / 2);

    if (session.selectedMainBranches.length >= maxSelectableMain) {
      throw new Error(
        `Cannot select more than ${maxSelectableMain} main branch(es)`
      );
    }
    if (session.selectedMainBranches.includes(args.mainBranchId)) {
      throw new Error("Main branch already selected");
    }

    const selectedMainBranches = [
      ...session.selectedMainBranches,
      args.mainBranchId,
    ];
    await ctx.db.patch(args.sessionId, {
      selectedMainBranches,
      currentMainBranchId: args.mainBranchId,
      currentState: "MAIN_INTRO",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const selectSubBranch = mutation({
  args: {
    sessionId: v.id("sessions"),
    subBranchId: v.id("subBranches"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }

    const currentMainBranchId = session.currentMainBranchId;
    if (currentMainBranchId === undefined) {
      throw new Error("No current main branch set");
    }

    const subBranch = await ctx.db.get(args.subBranchId);
    if (subBranch === null) {
      throw new Error("Sub branch not found");
    }
    if (subBranch.mainBranchId !== currentMainBranchId) {
      throw new Error("Sub branch does not belong to the current main branch");
    }

    const key = currentMainBranchId;
    const currentSubs = session.selectedSubBranches[key] ?? [];
    
    // User must always select exactly 2 sub branches per main branch
    const maxSelectableSub = 2;
    
    if (currentSubs.length >= maxSelectableSub) {
      throw new Error(
        `Cannot select more than ${maxSelectableSub} sub branch(es) for this main branch`
      );
    }
    if (currentSubs.includes(args.subBranchId)) {
      throw new Error("Sub branch already selected");
    }

    const selectedSubBranches = {
      ...session.selectedSubBranches,
      [key]: [...currentSubs, args.subBranchId],
    };
    await ctx.db.patch(args.sessionId, {
      selectedSubBranches,
      currentState: "SUB_PLAYING",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const selectAccusation = mutation({
  args: {
    sessionId: v.id("sessions"),
    accusationId: v.id("accusations"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }

    const accusation = await ctx.db.get(args.accusationId);
    if (accusation === null) {
      throw new Error("Accusation not found");
    }
    if (accusation.podcastId !== session.podcastId) {
      throw new Error("Accusation does not belong to the session's podcast");
    }

    await ctx.db.patch(args.sessionId, {
      currentState: "RESULT",
    });

    return {
      isCorrect: accusation.isCorrect,
      audioUrl: accusation.audioUrl,
    };
  },
});

export const finishSubBranch = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, {
      currentMainBranchId: undefined,
      currentState: "MAIN_SELECTION",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const startInvestigation = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }
    if (session.currentState !== "INTRO") {
      throw new Error("Session is not in INTRO state");
    }

    await ctx.db.patch(args.sessionId, {
      currentState: "MAIN_SELECTION",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const finishMainIntro = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }
    if (session.currentState !== "MAIN_INTRO") {
      throw new Error("Session is not in MAIN_INTRO state");
    }

    await ctx.db.patch(args.sessionId, {
      currentState: "SUB_SELECTION",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const returnToSubSelection = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }
    if (session.currentState !== "SUB_PLAYING") {
      throw new Error("Session is not in SUB_PLAYING state");
    }

    await ctx.db.patch(args.sessionId, {
      currentState: "SUB_SELECTION",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const finishAccusationIntro = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }
    if (session.currentState !== "ACCUSATION_INTRO") {
      throw new Error("Session is not in ACCUSATION_INTRO state");
    }

    await ctx.db.patch(args.sessionId, {
      currentState: "ACCUSATION_SELECTION",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

export const proceedToAccusations = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session === null) {
      throw new Error("Session not found");
    }
    if (session.currentState !== "MAIN_SELECTION") {
      throw new Error("Session is not in MAIN_SELECTION state");
    }

    // Verify max main branches reached
    const podcastMainBranches = await ctx.db
      .query("mainBranches")
      .withIndex("by_podcast", (q) => q.eq("podcastId", session.podcastId))
      .collect();
    const totalMainBranches = podcastMainBranches.length;
    const maxSelectableMain = Math.floor(totalMainBranches / 2);

    if (session.selectedMainBranches.length < maxSelectableMain) {
      throw new Error("Not all main branches have been selected yet");
    }

    await ctx.db.patch(args.sessionId, {
      currentState: "ACCUSATION_INTRO",
    });

    const updated = await ctx.db.get(args.sessionId);
    if (updated === null) throw new Error("Session not found after update");
    return updated;
  },
});

import { query } from "./_generated/server";
import { v } from "convex/values";

export const getPodcast = query({
  args: {
    podcastId: v.id("podcasts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.podcastId);
  },
});

export const getMainBranches = query({
  args: {
    podcastId: v.id("podcasts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mainBranches")
      .withIndex("by_podcast", (q) => q.eq("podcastId", args.podcastId))
      .collect();
  },
});

export const getSubBranches = query({
  args: {
    mainBranchId: v.id("mainBranches"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subBranches")
      .withIndex("by_mainBranch", (q) => q.eq("mainBranchId", args.mainBranchId))
      .collect();
  },
});

export const getAccusations = query({
  args: {
    podcastId: v.id("podcasts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accusations")
      .withIndex("by_podcast", (q) => q.eq("podcastId", args.podcastId))
      .collect();
  },
});

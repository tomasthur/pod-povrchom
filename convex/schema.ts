import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  podcasts: defineTable({
    title: v.string(),
    description: v.string(),
    introAudioUrl: v.string(),
  }),

  mainBranches: defineTable({
    podcastId: v.id("podcasts"),
    title: v.string(),
    introAudioUrl: v.string(),
  }).index("by_podcast", ["podcastId"]),

  subBranches: defineTable({
    mainBranchId: v.id("mainBranches"),
    title: v.string(),
    audioUrl: v.string(),
  }).index("by_mainBranch", ["mainBranchId"]),

  accusations: defineTable({
    podcastId: v.id("podcasts"),
    suspectName: v.string(),
    audioUrl: v.string(),
    isCorrect: v.boolean(),
  }).index("by_podcast", ["podcastId"]),

  sessions: defineTable({
    podcastId: v.id("podcasts"),
    selectedMainBranches: v.array(v.id("mainBranches")),
    selectedSubBranches: v.record(v.string(), v.array(v.id("subBranches"))),
    currentState: v.string(),
    currentMainBranchId: v.optional(v.id("mainBranches")),
  }),
});

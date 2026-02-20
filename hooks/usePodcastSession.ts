import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";

type Session = Doc<"sessions">;

export function usePodcastSession(sessionId: Id<"sessions"> | null | undefined) {
  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId } : "skip"
  );

  const selectMainBranchMutation = useMutation(api.sessions.selectMainBranch);
  const selectSubBranchMutation = useMutation(api.sessions.selectSubBranch);
  const finishSubBranchMutation = useMutation(api.sessions.finishSubBranch);
  const selectAccusationMutation = useMutation(api.sessions.selectAccusation);
  const startInvestigationMutation = useMutation(api.sessions.startInvestigation);
  const finishMainIntroMutation = useMutation(api.sessions.finishMainIntro);
  const finishAccusationIntroMutation = useMutation(api.sessions.finishAccusationIntro);

  const selectMainBranch = async (mainBranchId: Id<"mainBranches">) => {
    if (!sessionId) throw new Error("Session ID is required");
    return await selectMainBranchMutation({
      sessionId,
      mainBranchId,
    });
  };

  const selectSubBranch = async (subBranchId: Id<"subBranches">) => {
    if (!sessionId) throw new Error("Session ID is required");
    return await selectSubBranchMutation({
      sessionId,
      subBranchId,
    });
  };

  const finishSubBranch = async () => {
    if (!sessionId) throw new Error("Session ID is required");
    return await finishSubBranchMutation({
      sessionId,
    });
  };

  const selectAccusation = async (accusationId: Id<"accusations">) => {
    if (!sessionId) throw new Error("Session ID is required");
    return await selectAccusationMutation({
      sessionId,
      accusationId,
    });
  };

  const startInvestigation = async () => {
    if (!sessionId) throw new Error("Session ID is required");
    return await startInvestigationMutation({
      sessionId,
    });
  };

  const finishMainIntro = async () => {
    if (!sessionId) throw new Error("Session ID is required");
    return await finishMainIntroMutation({
      sessionId,
    });
  };

  const finishAccusationIntro = async () => {
    if (!sessionId) throw new Error("Session ID is required");
    return await finishAccusationIntroMutation({
      sessionId,
    });
  };

  return {
    session: session ?? null,
    selectMainBranch,
    selectSubBranch,
    finishSubBranch,
    selectAccusation,
    startInvestigation,
    finishMainIntro,
    finishAccusationIntro,
  };
}

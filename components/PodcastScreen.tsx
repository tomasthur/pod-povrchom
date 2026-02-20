import React, { useEffect, useState } from "react";
import { View, Text, Button } from "react-native";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePodcastSession } from "../hooks/usePodcastSession";
import type { Id } from "../convex/_generated/dataModel";

type PodcastScreenProps = {
  sessionId: Id<"sessions">;
};

export function PodcastScreen({ sessionId }: PodcastScreenProps) {
  const {
    session,
    selectMainBranch,
    selectSubBranch,
    finishSubBranch,
    selectAccusation,
    startInvestigation,
    finishMainIntro,
    finishAccusationIntro,
  } = usePodcastSession(sessionId);

  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  const [audioFinished, setAudioFinished] = useState(false);

  // Reset audio state when session state changes
  useEffect(() => {
    setAudioPlaying(null);
    setAudioFinished(false);
  }, [session?.currentState]);

  const podcast = useQuery(
    api.podcasts.getPodcast,
    session?.podcastId ? { podcastId: session.podcastId } : "skip"
  );

  const mainBranches = useQuery(
    api.podcasts.getMainBranches,
    session?.podcastId ? { podcastId: session.podcastId } : "skip"
  );

  const subBranches = useQuery(
    api.podcasts.getSubBranches,
    session?.currentMainBranchId ? { mainBranchId: session.currentMainBranchId } : "skip"
  );

  const accusations = useQuery(
    api.podcasts.getAccusations,
    session?.podcastId ? { podcastId: session.podcastId } : "skip"
  );

  // Handle audio playback completion
  const handleAudioFinished = () => {
    setAudioPlaying(null);
    setAudioFinished(true);
  };

  // INTRO state
  if (session?.currentState === "INTRO") {
    return (
      <View>
        <Text>INTRO State</Text>
        {podcast && (
          <>
            <Text>Playing intro audio: {podcast.introAudioUrl}</Text>
            {/* Audio player would go here */}
            <Button
              title="Start Investigation"
              onPress={async () => {
                await startInvestigation();
              }}
            />
          </>
        )}
      </View>
    );
  }

  // MAIN_SELECTION state
  if (session?.currentState === "MAIN_SELECTION") {
    const availableMainBranches =
      mainBranches?.filter(
        (mb) => !session.selectedMainBranches.includes(mb._id)
      ) ?? [];

    return (
      <View>
        <Text>MAIN_SELECTION State</Text>
        <Text>Select a main branch:</Text>
        {availableMainBranches.map((branch) => (
          <Button
            key={branch._id}
            title={branch.title}
            onPress={async () => {
              await selectMainBranch(branch._id);
            }}
          />
        ))}
      </View>
    );
  }

  // MAIN_INTRO state
  if (session?.currentState === "MAIN_INTRO") {
    const currentMainBranch = mainBranches?.find(
      (mb) => mb._id === session.currentMainBranchId
    );

    useEffect(() => {
      if (currentMainBranch && !audioPlaying && !audioFinished) {
        // Start playing audio
        setAudioPlaying(currentMainBranch.introAudioUrl);
        // Simulate audio playback - in real implementation, use audio library
        // After audio finishes, transition to SUB_SELECTION
        setTimeout(() => {
          handleAudioFinished();
        }, 3000); // Placeholder duration
      }
    }, [currentMainBranch, audioPlaying, audioFinished]);

    useEffect(() => {
      if (audioFinished && currentMainBranch) {
        setAudioFinished(false);
        finishMainIntro();
      }
    }, [audioFinished, currentMainBranch, finishMainIntro]);

    return (
      <View>
        <Text>MAIN_INTRO State</Text>
        {currentMainBranch && (
          <Text>Playing main intro: {currentMainBranch.introAudioUrl}</Text>
        )}
        {audioFinished && <Text>Loading sub branches...</Text>}
      </View>
    );
  }

  // SUB_SELECTION state
  if (session?.currentState === "SUB_SELECTION") {
    const currentMainBranchId = session.currentMainBranchId;
    const selectedSubsForMain = currentMainBranchId
      ? session.selectedSubBranches[currentMainBranchId] ?? []
      : [];
    const availableSubBranches =
      subBranches?.filter(
        (sb) => !selectedSubsForMain.includes(sb._id)
      ) ?? [];

    return (
      <View>
        <Text>SUB_SELECTION State</Text>
        <Text>Select sub branches:</Text>
        {availableSubBranches.map((branch) => (
          <Button
            key={branch._id}
            title={branch.title}
            onPress={async () => {
              await selectSubBranch(branch._id);
            }}
          />
        ))}
        <Button
          title="Finish Sub Branch"
          onPress={async () => {
            await finishSubBranch();
          }}
        />
      </View>
    );
  }

  // SUB_PLAYING state
  if (session?.currentState === "SUB_PLAYING") {
    const currentMainBranchId = session.currentMainBranchId;
    const selectedSubsForMain = currentMainBranchId
      ? session.selectedSubBranches[currentMainBranchId] ?? []
      : [];
    const lastSelectedSub = selectedSubsForMain[selectedSubsForMain.length - 1];
    const currentSubBranch = subBranches?.find(
      (sb) => sb._id === lastSelectedSub
    );

    useEffect(() => {
      if (currentSubBranch && !audioPlaying && !audioFinished) {
        setAudioPlaying(currentSubBranch.audioUrl);
        // Simulate audio playback
        setTimeout(() => {
          handleAudioFinished();
        }, 3000); // Placeholder duration
      }
    }, [currentSubBranch, audioPlaying, audioFinished]);

    useEffect(() => {
      if (audioFinished) {
        setAudioFinished(false);
        finishSubBranch();
      }
    }, [audioFinished, finishSubBranch]);

    return (
      <View>
        <Text>SUB_PLAYING State</Text>
        {currentSubBranch && (
          <Text>Playing sub branch audio: {currentSubBranch.audioUrl}</Text>
        )}
      </View>
    );
  }

  // ACCUSATION_INTRO state
  if (session?.currentState === "ACCUSATION_INTRO") {
    useEffect(() => {
      // Play accusation intro audio
      // After audio finishes, transition to ACCUSATION_SELECTION
      if (!audioPlaying && !audioFinished) {
        setAudioPlaying("accusation_intro_url"); // Placeholder
        setTimeout(() => {
          handleAudioFinished();
        }, 2000);
      }
    }, [audioPlaying, audioFinished]);

    useEffect(() => {
      if (audioFinished) {
        setAudioFinished(false);
        finishAccusationIntro();
      }
    }, [audioFinished, finishAccusationIntro]);

    return (
      <View>
        <Text>ACCUSATION_INTRO State</Text>
        <Text>Playing accusation intro...</Text>
      </View>
    );
  }

  // ACCUSATION_SELECTION state
  if (session?.currentState === "ACCUSATION_SELECTION") {
    return (
      <View>
        <Text>ACCUSATION_SELECTION State</Text>
        <Text>Select a suspect:</Text>
        {accusations?.map((accusation) => (
          <Button
            key={accusation._id}
            title={accusation.suspectName}
            onPress={async () => {
              await selectAccusation(accusation._id);
            }}
          />
        ))}
      </View>
    );
  }

  // RESULT state
  if (session?.currentState === "RESULT") {
    // The result audio URL would come from selectAccusation return value
    // For now, we'll need to store it in session or get it from the last accusation
    return (
      <View>
        <Text>RESULT State</Text>
        <Text>Playing result audio...</Text>
      </View>
    );
  }

  // Loading or unknown state
  if (!session) {
    return (
      <View>
        <Text>Loading session...</Text>
      </View>
    );
  }

  return (
    <View>
      <Text>Unknown state: {session.currentState}</Text>
    </View>
  );
}

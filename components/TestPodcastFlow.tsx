import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePodcastSession } from "../hooks/usePodcastSession";
import type { Id } from "../convex/_generated/dataModel";

const TEST_PODCAST_ID = "jd7dad9y0g1bk0f05pyvxcap5581h2c3" as Id<"podcasts">;

export function TestPodcastFlow() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);

  const createSessionMutation = useMutation(api.sessions.createSession);
  const {
    session,
    selectMainBranch,
    selectSubBranch,
    finishSubBranch,
    selectAccusation,
    startInvestigation,
    finishMainIntro,
    finishAccusationIntro,
    proceedToAccusations,
    returnToSubSelection,
  } = usePodcastSession(sessionId);

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

  // Initialize session
  useEffect(() => {
    if (!sessionId && !isCreatingSession) {
      setIsCreatingSession(true);
      createSessionMutation({ podcastId: TEST_PODCAST_ID })
        .then((id) => {
          setSessionId(id);
          setIsCreatingSession(false);
        })
        .catch((error) => {
          console.error("Failed to create session:", error);
          Alert.alert("Error", `Failed to create session: ${error.message}`);
          setIsCreatingSession(false);
        });
    }
  }, [sessionId, isCreatingSession, createSessionMutation]);

  // Handle MAIN_INTRO - auto transition after 2s
  useEffect(() => {
    if (session?.currentState === "MAIN_INTRO") {
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }
      audioTimerRef.current = setTimeout(() => {
        finishMainIntro().catch((error) => {
          console.error("Error finishing main intro:", error);
        });
      }, 2000);
      return () => {
        if (audioTimerRef.current) {
          clearTimeout(audioTimerRef.current);
        }
      };
    }
  }, [session?.currentState, finishMainIntro]);

  // Handle SUB_PLAYING - after audio, check if we need to select more or finish
  useEffect(() => {
    if (session?.currentState === "SUB_PLAYING") {
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }
      audioTimerRef.current = setTimeout(() => {
        // Check how many sub branches are selected
        const currentMainBranchId = session.currentMainBranchId;
        const selectedSubsForMain = currentMainBranchId
          ? session.selectedSubBranches[currentMainBranchId] ?? []
          : [];
        
        if (selectedSubsForMain.length === 2) {
          // We have 2 sub branches, finish and go back to main selection
          finishSubBranch().catch((error) => {
            console.error("Error finishing sub branch:", error);
          });
        } else {
          // We have less than 2, go back to SUB_SELECTION to select more
          returnToSubSelection().catch((error) => {
            console.error("Error returning to sub selection:", error);
          });
        }
      }, 2000);
      return () => {
        if (audioTimerRef.current) {
          clearTimeout(audioTimerRef.current);
        }
      };
    }
  }, [session?.currentState, session?.selectedSubBranches, finishSubBranch, returnToSubSelection]);

  // Handle ACCUSATION_INTRO - auto transition after 2s
  useEffect(() => {
    if (session?.currentState === "ACCUSATION_INTRO") {
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
      }
      audioTimerRef.current = setTimeout(() => {
        finishAccusationIntro().catch((error) => {
          console.error("Error finishing accusation intro:", error);
        });
      }, 2000);
      return () => {
        if (audioTimerRef.current) {
          clearTimeout(audioTimerRef.current);
        }
      };
    }
  }, [session?.currentState, finishAccusationIntro]);

  // Handle auto-finish when 2 sub branches are selected
  const currentMainBranchId = session?.currentMainBranchId;
  const selectedSubsForMain = currentMainBranchId
    ? session?.selectedSubBranches[currentMainBranchId] ?? []
    : [];
  
  useEffect(() => {
    if (
      session?.currentState === "SUB_SELECTION" &&
      selectedSubsForMain.length === 2
    ) {
      finishSubBranch().catch((error) => {
        console.error("Error finishing sub branch:", error);
      });
    }
  }, [session?.currentState, selectedSubsForMain.length, finishSubBranch]);

  // INTRO state
  if (!session || session.currentState === "INTRO") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Test Podcast Flow</Text>
        {isCreatingSession ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Creating session...</Text>
          </View>
        ) : podcast ? (
          <View>
            <Text style={styles.sectionTitle}>Podcast: {podcast.title}</Text>
            <Text style={styles.description}>{podcast.description}</Text>
            <View style={styles.buttonContainer}>
              <Button
                title="Start Investigation"
                onPress={async () => {
                  try {
                    await startInvestigation();
                  } catch (error: any) {
                    Alert.alert("Error", error.message);
                  }
                }}
              />
            </View>
          </View>
        ) : (
          <Text>Loading podcast...</Text>
        )}
      </ScrollView>
    );
  }

  // MAIN_SELECTION state
  if (session.currentState === "MAIN_SELECTION") {
    const availableMainBranches =
      mainBranches?.filter(
        (mb) => !session.selectedMainBranches.includes(mb._id)
      ) ?? [];

    const totalMainBranches = mainBranches?.length ?? 0;
    const maxSelectableMain = Math.floor(totalMainBranches / 2);
    const canSelectMore = session.selectedMainBranches.length < maxSelectableMain;

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Select Main Branch</Text>
        <Text style={styles.info}>
          Selected: {session.selectedMainBranches.length} / {maxSelectableMain}
        </Text>
        {canSelectMore ? (
          <>
            <Text style={styles.sectionTitle}>Available Main Branches:</Text>
            {availableMainBranches.map((branch) => (
              <View key={branch._id} style={styles.buttonContainer}>
                <Button
                  title={branch.title}
                  onPress={async () => {
                    try {
                      await selectMainBranch(branch._id);
                    } catch (error: any) {
                      Alert.alert("Error", error.message);
                    }
                  }}
                />
              </View>
            ))}
          </>
        ) : (
          <View>
            <Text style={styles.warning}>
              Maximum main branches selected ({maxSelectableMain}).
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                title="Go to Accusations"
                onPress={async () => {
                  try {
                    await proceedToAccusations();
                  } catch (error: any) {
                    Alert.alert("Error", error.message);
                  }
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // MAIN_INTRO state
  if (session.currentState === "MAIN_INTRO") {
    const currentMainBranch = mainBranches?.find(
      (mb) => mb._id === session.currentMainBranchId
    );

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Main Branch Intro</Text>
        {currentMainBranch && (
          <>
            <Text style={styles.sectionTitle}>{currentMainBranch.title}</Text>
            <Text style={styles.audioInfo}>
              Playing: {currentMainBranch.introAudioUrl}
            </Text>
            <View style={styles.center}>
              <ActivityIndicator size="large" />
              <Text>Playing audio (2s)...</Text>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // SUB_SELECTION state
  if (session.currentState === "SUB_SELECTION") {
    const availableSubBranches =
      subBranches?.filter(
        (sb) => !selectedSubsForMain.includes(sb._id)
      ) ?? [];

    const mustSelect = 2; // User must always select exactly 2 sub branches

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Select Sub Branches</Text>
        <Text style={styles.info}>
          Selected: {selectedSubsForMain.length} / {mustSelect} (required)
        </Text>
        {selectedSubsForMain.length < mustSelect ? (
          <>
            <Text style={styles.sectionTitle}>Available Sub Branches:</Text>
            {availableSubBranches.length > 0 ? (
              availableSubBranches.map((branch) => (
                <View key={branch._id} style={styles.buttonContainer}>
                  <Button
                    title={branch.title}
                    onPress={async () => {
                      try {
                        await selectSubBranch(branch._id);
                      } catch (error: any) {
                        Alert.alert("Error", error.message);
                      }
                    }}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.warning}>
                No more sub branches available. Please select from already selected ones or contact support.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Completing selection...</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // SUB_PLAYING state
  if (session.currentState === "SUB_PLAYING") {
    const currentMainBranchId = session.currentMainBranchId;
    const selectedSubsForMain = currentMainBranchId
      ? session.selectedSubBranches[currentMainBranchId] ?? []
      : [];
    const lastSelectedSub = selectedSubsForMain[selectedSubsForMain.length - 1];
    const currentSubBranch = subBranches?.find(
      (sb) => sb._id === lastSelectedSub
    );

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Playing Sub Branch</Text>
        {currentSubBranch && (
          <>
            <Text style={styles.sectionTitle}>{currentSubBranch.title}</Text>
            <Text style={styles.audioInfo}>
              Playing: {currentSubBranch.audioUrl}
            </Text>
            <View style={styles.center}>
              <ActivityIndicator size="large" />
              <Text>Playing audio (2s)...</Text>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // ACCUSATION_INTRO state
  if (session.currentState === "ACCUSATION_INTRO") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Accusation Intro</Text>
        <Text style={styles.audioInfo}>
          Playing accusation intro audio...
        </Text>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Playing audio (2s)...</Text>
        </View>
      </ScrollView>
    );
  }

  // ACCUSATION_SELECTION state
  if (session.currentState === "ACCUSATION_SELECTION") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Select Suspect</Text>
        <Text style={styles.sectionTitle}>Choose an accusation:</Text>
        {accusations?.map((accusation) => (
          <View key={accusation._id} style={styles.buttonContainer}>
            <Button
              title={accusation.suspectName}
              onPress={async () => {
                try {
                  const result = await selectAccusation(accusation._id);
                  Alert.alert(
                    "Result",
                    `Is Correct: ${result.isCorrect ? "Yes ✅" : "No ❌"}\nAudio: ${result.audioUrl}`,
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          setSessionId(null);
                          setIsCreatingSession(false);
                        },
                      },
                    ]
                  );
                } catch (error: any) {
                  Alert.alert("Error", error.message);
                }
              }}
            />
          </View>
        ))}
      </ScrollView>
    );
  }

  // RESULT state
  if (session.currentState === "RESULT") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Result</Text>
        <Text>Playing result audio...</Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Back to Main Menu"
            onPress={() => {
              setSessionId(null);
              setIsCreatingSession(false);
            }}
          />
        </View>
      </ScrollView>
    );
  }

  // Unknown state
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Unknown State</Text>
      {session && (
        <Text style={styles.info}>Current State: {session.currentState}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  audioInfo: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 15,
  },
  info: {
    fontSize: 14,
    marginBottom: 15,
    color: "#333",
  },
  warning: {
    fontSize: 14,
    color: "#ff6b00",
    marginBottom: 15,
  },
  buttonContainer: {
    marginVertical: 5,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});

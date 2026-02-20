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
import { Audio } from "expo-av";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePodcastSession } from "../hooks/usePodcastSession";
import type { Id } from "../convex/_generated/dataModel";

const TEST_PODCAST_ID = "jd7dad9y0g1bk0f05pyvxcap5581h2c3" as Id<"podcasts">;

export function TestPodcastFlow() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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

  // Calculate selected sub branches for current main branch
  const currentMainBranchId = session?.currentMainBranchId;
  const selectedSubsForMain = currentMainBranchId
    ? session?.selectedSubBranches[currentMainBranchId] ?? []
    : [];

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

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

  // Helper function to play audio
  const playAudio = async (
    audioUrl: string,
    onFinished: () => void,
    onError?: (error: Error) => void
  ) => {
    try {
      setIsLoadingAudio(true);
      setAudioError(null);

      // Stop and unload previous audio if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Load and play new audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      setIsLoadingAudio(false);
      setIsPlayingAudio(true);

      // Wait for playback to finish
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setIsPlayingAudio(false);
            onFinished();
          }
        } else if (status.error) {
          setIsLoadingAudio(false);
          setIsPlayingAudio(false);
          const error = new Error(status.error || "Audio playback error");
          setAudioError(error.message);
          if (onError) {
            onError(error);
          } else {
            Alert.alert("Audio Error", error.message);
          }
        }
      });
    } catch (error: any) {
      setIsLoadingAudio(false);
      setIsPlayingAudio(false);
      const errorMessage = error.message || "Failed to load audio";
      setAudioError(errorMessage);
      if (onError) {
        onError(error);
      } else {
        Alert.alert("Audio Error", errorMessage);
      }
    }
  };

  // Handle MAIN_INTRO - play audio and transition when finished
  useEffect(() => {
    if (session?.currentState === "MAIN_INTRO") {
      const currentMainBranch = mainBranches?.find(
        (mb) => mb._id === session.currentMainBranchId
      );

      if (currentMainBranch && !isLoadingAudio && !isPlayingAudio) {
        playAudio(
          currentMainBranch.introAudioUrl,
          () => {
            finishMainIntro().catch((error) => {
              console.error("Error finishing main intro:", error);
              Alert.alert("Error", `Failed to transition: ${error.message}`);
            });
          },
          (error) => {
            console.error("Audio playback error:", error);
            // On error, still allow transition
            finishMainIntro().catch((err) => {
              console.error("Error finishing main intro:", err);
            });
          }
        );
      }

      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(console.error);
        }
      };
    }
  }, [
    session?.currentState,
    session?.currentMainBranchId,
    mainBranches,
    isLoadingAudio,
    isPlayingAudio,
    finishMainIntro,
  ]);

  // Handle SUB_PLAYING - play audio and check if we need to select more or finish
  useEffect(() => {
    if (session?.currentState === "SUB_PLAYING") {
      const lastSelectedSub = selectedSubsForMain[selectedSubsForMain.length - 1];
      const currentSubBranch = subBranches?.find(
        (sb) => sb._id === lastSelectedSub
      );

      if (currentSubBranch && !isLoadingAudio && !isPlayingAudio) {
        playAudio(
          currentSubBranch.audioUrl,
          () => {
            // Check how many sub branches are selected
            if (selectedSubsForMain.length === 2) {
              // We have 2 sub branches, finish and go back to main selection
              finishSubBranch().catch((error) => {
                console.error("Error finishing sub branch:", error);
                Alert.alert("Error", `Failed to finish: ${error.message}`);
              });
            } else {
              // We have less than 2, go back to SUB_SELECTION to select more
              returnToSubSelection().catch((error) => {
                console.error("Error returning to sub selection:", error);
                Alert.alert("Error", `Failed to return: ${error.message}`);
              });
            }
          },
          (error) => {
            console.error("Audio playback error:", error);
            // On error, still allow transition
            if (selectedSubsForMain.length === 2) {
              finishSubBranch().catch((err) => {
                console.error("Error finishing sub branch:", err);
              });
            } else {
              returnToSubSelection().catch((err) => {
                console.error("Error returning to sub selection:", err);
              });
            }
          }
        );
      }

      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(console.error);
        }
      };
    }
  }, [
    session?.currentState,
    selectedSubsForMain.length,
    subBranches,
    isLoadingAudio,
    isPlayingAudio,
    finishSubBranch,
    returnToSubSelection,
  ]);

  // Handle ACCUSATION_INTRO - play audio and transition when finished
  useEffect(() => {
    if (session?.currentState === "ACCUSATION_INTRO") {
      if (!isLoadingAudio && !isPlayingAudio) {
        // For now, use a placeholder URL - in real app this would come from session or podcast data
        const accusationIntroUrl = "https://example.com/accusation-intro.mp3";
        playAudio(
          accusationIntroUrl,
          () => {
            finishAccusationIntro().catch((error) => {
              console.error("Error finishing accusation intro:", error);
              Alert.alert("Error", `Failed to transition: ${error.message}`);
            });
          },
          (error) => {
            console.error("Audio playback error:", error);
            // On error, still allow transition
            finishAccusationIntro().catch((err) => {
              console.error("Error finishing accusation intro:", err);
            });
          }
        );
      }

      return () => {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(console.error);
        }
      };
    }
  }, [session?.currentState, isLoadingAudio, isPlayingAudio, finishAccusationIntro]);

  // Handle auto-finish when 2 sub branches are selected in SUB_SELECTION state
  useEffect(() => {
    if (
      session?.currentState === "SUB_SELECTION" &&
      selectedSubsForMain.length === 2
    ) {
      finishSubBranch().catch((error) => {
        console.error("Error finishing sub branch:", error);
        Alert.alert("Error", `Failed to finish: ${error.message}`);
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
        ) : podcast === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading podcast...</Text>
          </View>
        ) : podcast === null ? (
          <View>
            <Text style={styles.error}>Failed to load podcast</Text>
            <Button
              title="Retry"
              onPress={() => {
                setSessionId(null);
                setIsCreatingSession(false);
              }}
            />
          </View>
        ) : (
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

    if (mainBranches === undefined) {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading main branches...</Text>
          </View>
        </ScrollView>
      );
    }

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

    if (mainBranches === undefined) {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading main branch...</Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Main Branch Intro</Text>
        {currentMainBranch ? (
          <>
            <Text style={styles.sectionTitle}>{currentMainBranch.title}</Text>
            <Text style={styles.audioInfo}>
              Audio: {currentMainBranch.introAudioUrl}
            </Text>
            {isLoadingAudio && (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Loading audio...</Text>
              </View>
            )}
            {isPlayingAudio && (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Playing audio...</Text>
              </View>
            )}
            {audioError && (
              <View>
                <Text style={styles.error}>Audio Error: {audioError}</Text>
                <Button
                  title="Continue Anyway"
                  onPress={() => {
                    setAudioError(null);
                    finishMainIntro().catch((error) => {
                      Alert.alert("Error", error.message);
                    });
                  }}
                />
              </View>
            )}
          </>
        ) : (
          <Text style={styles.error}>Main branch not found</Text>
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

    if (subBranches === undefined) {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading sub branches...</Text>
          </View>
        </ScrollView>
      );
    }

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
    const lastSelectedSub = selectedSubsForMain[selectedSubsForMain.length - 1];
    const currentSubBranch = subBranches?.find(
      (sb) => sb._id === lastSelectedSub
    );

    if (subBranches === undefined) {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading sub branch...</Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Playing Sub Branch</Text>
        {currentSubBranch ? (
          <>
            <Text style={styles.sectionTitle}>{currentSubBranch.title}</Text>
            <Text style={styles.audioInfo}>
              Audio: {currentSubBranch.audioUrl}
            </Text>
            {isLoadingAudio && (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Loading audio...</Text>
              </View>
            )}
            {isPlayingAudio && (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Playing audio...</Text>
              </View>
            )}
            {audioError && (
              <View>
                <Text style={styles.error}>Audio Error: {audioError}</Text>
                <Button
                  title="Continue Anyway"
                  onPress={() => {
                    setAudioError(null);
                    if (selectedSubsForMain.length === 2) {
                      finishSubBranch().catch((error) => {
                        Alert.alert("Error", error.message);
                      });
                    } else {
                      returnToSubSelection().catch((error) => {
                        Alert.alert("Error", error.message);
                      });
                    }
                  }}
                />
              </View>
            )}
          </>
        ) : (
          <Text style={styles.error}>Sub branch not found</Text>
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
        {isLoadingAudio && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading audio...</Text>
          </View>
        )}
        {isPlayingAudio && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Playing audio...</Text>
          </View>
        )}
        {audioError && (
          <View>
            <Text style={styles.error}>Audio Error: {audioError}</Text>
            <Button
              title="Continue Anyway"
              onPress={() => {
                setAudioError(null);
                finishAccusationIntro().catch((error) => {
                  Alert.alert("Error", error.message);
                });
              }}
            />
          </View>
        )}
      </ScrollView>
    );
  }

  // ACCUSATION_SELECTION state
  if (session.currentState === "ACCUSATION_SELECTION") {
    if (accusations === undefined) {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading accusations...</Text>
          </View>
        </ScrollView>
      );
    }

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
                  // Play result audio
                  if (result.audioUrl) {
                    playAudio(
                      result.audioUrl,
                      () => {
                        Alert.alert(
                          "Result",
                          `Is Correct: ${result.isCorrect ? "Yes ✅" : "No ❌"}`,
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
                      },
                      (error) => {
                        console.error("Result audio error:", error);
                        // Show result even if audio fails
                        Alert.alert(
                          "Result",
                          `Is Correct: ${result.isCorrect ? "Yes ✅" : "No ❌"}`,
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
                      }
                    );
                  } else {
                    Alert.alert(
                      "Result",
                      `Is Correct: ${result.isCorrect ? "Yes ✅" : "No ❌"}`,
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
                  }
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
        {isLoadingAudio && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Loading result audio...</Text>
          </View>
        )}
        {isPlayingAudio && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Playing result audio...</Text>
          </View>
        )}
        {audioError && (
          <Text style={styles.error}>Audio Error: {audioError}</Text>
        )}
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
  error: {
    fontSize: 14,
    color: "#dc2626",
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

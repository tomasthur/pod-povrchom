import React, { useEffect, useState, useRef, useCallback } from "react";
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
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePodcastSession } from "../hooks/usePodcastSession";
import { useAutoVoiceRecording } from "../hooks/useAutoVoiceRecording";
import type { Id } from "../convex/_generated/dataModel";

export function TestPodcastFlow() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [selectedPodcastId, setSelectedPodcastId] = useState<
    Id<"podcasts"> | null
  >(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioPlayedKeyRef = useRef<string | null>(null);
  const proceedingRef = useRef(false);
  const [voiceMode, setVoiceMode] = useState<"buttons" | "voice">("buttons");

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

  const podcasts = useQuery(api.podcasts.listPodcasts, {});
  const recognizeVoiceChoice = useAction(api.voice.recognizeVoiceChoice);

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
    session?.currentMainBranchId
      ? { mainBranchId: session.currentMainBranchId }
      : "skip"
  );

  const accusations = useQuery(
    api.podcasts.getAccusations,
    session?.podcastId ? { podcastId: session.podcastId } : "skip"
  );

  const currentMainBranchId = session?.currentMainBranchId;
  const selectedSubsForMain = currentMainBranchId
    ? session?.selectedSubBranches[currentMainBranchId] ?? []
    : [];

  // --- Derived data for voice ---

  const currentState = session?.currentState ?? "";

  const availableMainBranches =
    currentState === "MAIN_SELECTION"
      ? mainBranches?.filter(
          (mb) => !session!.selectedMainBranches.includes(mb._id)
        ) ?? []
      : [];

  const availableSubBranches =
    currentState === "SUB_SELECTION"
      ? subBranches?.filter(
          (sb) => !selectedSubsForMain.includes(sb._id)
        ) ?? []
      : [];

  const currentAccusations =
    currentState === "ACCUSATION_SELECTION" ? accusations ?? [] : [];

  const voiceNumOptions =
    currentState === "MAIN_SELECTION"
      ? availableMainBranches.length
      : currentState === "SUB_SELECTION"
      ? availableSubBranches.length
      : currentState === "ACCUSATION_SELECTION"
      ? currentAccusations.length
      : 0;

  const voiceActive =
    voiceMode === "voice" &&
    voiceNumOptions > 0 &&
    ["MAIN_SELECTION", "SUB_SELECTION", "ACCUSATION_SELECTION"].includes(
      currentState
    ) &&
    !isPlayingAudio &&
    !isLoadingAudio;

  const handleVoiceChoice = useCallback(
    async (index: number) => {
      const state = session?.currentState;
      try {
        if (state === "MAIN_SELECTION") {
          const branch = availableMainBranches[index];
          if (branch) await selectMainBranch(branch._id);
        } else if (state === "SUB_SELECTION") {
          const branch = availableSubBranches[index];
          if (branch) await selectSubBranch(branch._id);
        } else if (state === "ACCUSATION_SELECTION") {
          const accusation = currentAccusations[index];
          if (accusation) {
            const result = await selectAccusation(accusation._id);
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
          }
        }
      } catch (error: any) {
        Alert.alert("Error", error.message);
      }
    },
    [
      session?.currentState,
      availableMainBranches,
      availableSubBranches,
      currentAccusations,
      selectMainBranch,
      selectSubBranch,
      selectAccusation,
    ]
  );

  const handleVoiceError = useCallback((transcript: string) => {
    Alert.alert(
      "Nerozpoznal som výber",
      transcript
        ? `Rozpoznaný text: "${transcript}"\n\nPovedz napr. "A", "jedna" alebo "možnosť 1".`
        : "Nerozpoznal som nič. Povedz jasne \"A\", \"B\" alebo klikni na tlačidlo."
    );
  }, []);

  const voice = useAutoVoiceRecording({
    active: voiceActive,
    numOptions: voiceNumOptions,
    recognizeFn: recognizeVoiceChoice,
    onChoice: handleVoiceChoice,
    onError: handleVoiceError,
  });

  // --- Audio setup ---

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch((err) => {
      console.warn("Failed to set audio mode", err);
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    audioPlayedKeyRef.current = null;
  }, [session?.currentState, session?.currentMainBranchId]);

  // --- Audio playback helper ---

  const playAudio = async (
    audioUrl: string,
    onFinished: () => void,
    onError?: (error: Error) => void
  ) => {
    try {
      setIsLoadingAudio(true);
      setAudioError(null);

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      setIsLoadingAudio(false);
      setIsPlayingAudio(true);

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

  // --- Auto-play effects for non-selection states ---

  useEffect(() => {
    if (session?.currentState === "MAIN_INTRO") {
      const key = `MAIN_INTRO-${session.currentMainBranchId}`;
      if (audioPlayedKeyRef.current === key) return;

      const currentMainBranch = mainBranches?.find(
        (mb) => mb._id === session.currentMainBranchId
      );

      if (currentMainBranch) {
        audioPlayedKeyRef.current = key;
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
  }, [session?.currentState, session?.currentMainBranchId, mainBranches, finishMainIntro]);

  useEffect(() => {
    if (session?.currentState === "SUB_PLAYING") {
      const lastSelectedSub =
        selectedSubsForMain[selectedSubsForMain.length - 1];
      const currentSubBranch = subBranches?.find(
        (sb) => sb._id === lastSelectedSub
      );

      if (currentSubBranch) {
        const key = `SUB_PLAYING-${lastSelectedSub}`;
        if (audioPlayedKeyRef.current === key) return;
        audioPlayedKeyRef.current = key;

        playAudio(
          currentSubBranch.audioUrl,
          () => {
            if (selectedSubsForMain.length === 2) {
              finishSubBranch().catch((error) => {
                console.error("Error finishing sub branch:", error);
                Alert.alert("Error", `Failed to finish: ${error.message}`);
              });
            } else {
              returnToSubSelection().catch((error) => {
                console.error("Error returning to sub selection:", error);
                Alert.alert("Error", `Failed to return: ${error.message}`);
              });
            }
          },
          (error) => {
            console.error("Audio playback error:", error);
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
    finishSubBranch,
    returnToSubSelection,
  ]);

  useEffect(() => {
    if (session?.currentState === "ACCUSATION_INTRO") {
      const key = "ACCUSATION_INTRO";
      if (audioPlayedKeyRef.current === key) return;

      const accusationIntroUrl =
        (podcast as any)?.accusationIntroAudioUrl ?? podcast?.introAudioUrl;

      if (accusationIntroUrl) {
        audioPlayedKeyRef.current = key;
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
            finishAccusationIntro().catch((err) => {
              console.error("Error finishing accusation intro:", err);
            });
          }
        );
      } else {
        finishAccusationIntro().catch((error) => {
          console.error("Error finishing accusation intro:", error);
          Alert.alert("Error", `Failed to transition: ${error.message}`);
        });
      }
    }
  }, [session?.currentState, podcast, finishAccusationIntro]);

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

  // Auto-proceed to accusations when max main branches selected
  useEffect(() => {
    if (session?.currentState !== "MAIN_SELECTION") {
      proceedingRef.current = false;
      return;
    }
    const total = mainBranches?.length ?? 0;
    if (total === 0) return;
    const max = Math.floor(total / 2);
    if (session.selectedMainBranches.length >= max && !proceedingRef.current) {
      proceedingRef.current = true;
      proceedToAccusations().catch((error) => {
        proceedingRef.current = false;
        console.error("Error proceeding to accusations:", error);
        Alert.alert("Error", `Failed to proceed: ${error.message}`);
      });
    }
  }, [session?.currentState, session?.selectedMainBranches.length, mainBranches?.length, proceedToAccusations]);

  // --- Session creation ---

  useEffect(() => {
    if (!sessionId && !isCreatingSession && selectedPodcastId) {
      setIsCreatingSession(true);
      createSessionMutation({ podcastId: selectedPodcastId })
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
  }, [sessionId, isCreatingSession, createSessionMutation, selectedPodcastId]);

  // --- Voice status indicator (reusable) ---

  const VoiceStatus = () => {
    if (voiceMode !== "voice") return null;
    if (!voice.isRecording && !voice.isProcessing && !voice.lastError)
      return null;

    return (
      <View style={styles.voiceStatus}>
        <Text
          style={[
            styles.voiceStatusText,
            voice.lastError && styles.voiceStatusError,
          ]}
        >
          {voice.isProcessing
            ? "⏳ Spracovávam hlas..."
            : voice.isRecording
            ? "🎙 Nahrávam... Povedz A, B alebo jedna, dva"
            : voice.lastError}
        </Text>
        {voice.isRecording && (
          <Button
            title="Spracuj teraz"
            onPress={voice.stopAndRecognize}
          />
        )}
      </View>
    );
  };

  // ===== RENDER =====

  // PODCAST SELECTION
  if (!selectedPodcastId) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Vyber si podcast</Text>
        <Text style={styles.info}>
          Režim ovládania:{" "}
          {voiceMode === "voice" ? "Hlas + tlačidlá" : "Len tlačidlá"}
        </Text>
        <View style={styles.buttonContainer}>
          <Button
            title="Len tlačidlá"
            onPress={() => setVoiceMode("buttons")}
          />
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title="Hlas + tlačidlá"
            onPress={() => setVoiceMode("voice")}
          />
        </View>
        {podcasts === undefined ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Načítavam podcasty...</Text>
          </View>
        ) : podcasts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.error}>
              Zatiaľ nemáš v Convexe žiadne podcasty.
            </Text>
          </View>
        ) : (
          <View>
            {podcasts.map((p: any) => (
              <View key={p._id} style={styles.buttonContainer}>
                <Button
                  title={p.title}
                  onPress={() => setSelectedPodcastId(p._id)}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // INTRO
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
            {isLoadingAudio && (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Loading intro audio...</Text>
              </View>
            )}
            {isPlayingAudio && (
              <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Playing intro audio...</Text>
              </View>
            )}
            {audioError && (
              <Text style={styles.error}>Audio Error: {audioError}</Text>
            )}
            <View style={styles.buttonContainer}>
              <Button
                title="Start Investigation"
                onPress={async () => {
                  try {
                    if (
                      podcast.introAudioUrl &&
                      !isLoadingAudio &&
                      !isPlayingAudio
                    ) {
                      await playAudio(
                        podcast.introAudioUrl,
                        () => {
                          startInvestigation().catch((error) => {
                            Alert.alert("Error", error.message);
                          });
                        },
                        (error) => {
                          console.error("Intro audio error:", error);
                          startInvestigation().catch((err) => {
                            Alert.alert("Error", err.message);
                          });
                        }
                      );
                    } else {
                      await startInvestigation();
                    }
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

  // MAIN_SELECTION
  if (session.currentState === "MAIN_SELECTION") {
    const totalMainBranches = mainBranches?.length ?? 0;
    const maxSelectableMain = Math.floor(totalMainBranches / 2);
    const canSelectMore =
      session.selectedMainBranches.length < maxSelectableMain;

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
        <VoiceStatus />
        {canSelectMore ? (
          <>
            <Text style={styles.sectionTitle}>Available Main Branches:</Text>
            {availableMainBranches.map((branch, idx) => (
              <View key={branch._id} style={styles.buttonContainer}>
                <Button
                  title={`${String.fromCharCode(65 + idx)}: ${branch.title}`}
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
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text>Prechádzam na obvinenia...</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  // MAIN_INTRO
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

  // SUB_SELECTION
  if (session.currentState === "SUB_SELECTION") {
    const mustSelect = 2;

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
        <VoiceStatus />
        {selectedSubsForMain.length < mustSelect ? (
          <>
            <Text style={styles.sectionTitle}>Available Sub Branches:</Text>
            {availableSubBranches.length > 0 ? (
              availableSubBranches.map((branch, idx) => (
                <View key={branch._id} style={styles.buttonContainer}>
                  <Button
                    title={`${String.fromCharCode(65 + idx)}: ${branch.title}`}
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
                No more sub branches available.
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

  // SUB_PLAYING
  if (session.currentState === "SUB_PLAYING") {
    const lastSelectedSub =
      selectedSubsForMain[selectedSubsForMain.length - 1];
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

  // ACCUSATION_INTRO
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

  // ACCUSATION_SELECTION
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
        <VoiceStatus />
        {accusations?.map((accusation, idx) => (
          <View key={accusation._id} style={styles.buttonContainer}>
            <Button
              title={`${String.fromCharCode(65 + idx)}: ${accusation.suspectName}`}
              onPress={async () => {
                try {
                  const result = await selectAccusation(accusation._id);
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

  // RESULT
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
  voiceStatus: {
    backgroundColor: "#f0f4ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  voiceStatusText: {
    fontSize: 14,
    color: "#4338ca",
    textAlign: "center",
    marginBottom: 4,
  },
  voiceStatusError: {
    color: "#dc2626",
  },
});

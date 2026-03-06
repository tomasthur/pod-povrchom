import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  ImageBackground,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Audio } from "expo-av";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { usePodcastSession } from "../hooks/usePodcastSession";
import { useAutoVoiceRecording } from "../hooks/useAutoVoiceRecording";
import { colors, fonts, spacing, radii, typography, shadows } from "../theme";
import type { Id } from "../convex/_generated/dataModel";

const BG_IMAGE = require("../assets/background.png");
const { width: SCREEN_W } = Dimensions.get("window");

// ─── Animation helpers ────────────────────────────────────────────

function useFadeIn(delay = 0, duration = 500) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return { opacity, transform: [{ translateY }] };
}

function usePulse(min = 0.3, max = 1, dur = 700) {
  const a = useRef(new Animated.Value(max)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: min, duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(a, { toValue: max, duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return a;
}

function useScalePulse(min = 1, max = 1.18, dur = 900) {
  const a = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: max, duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(a, { toValue: min, duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return a;
}

// ─── Screen wrapper with background ──────────────────────────────

function Screen({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <ImageBackground source={BG_IMAGE} style={s.bgImage} resizeMode="cover">
      <View style={s.overlay} />
      <ScrollView
        style={s.screen}
        contentContainerStyle={padded ? s.screenContent : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </ImageBackground>
  );
}

// ─── Reusable UI Components ───────────────────────────────────────

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[s.glassCardOuter, style]}>
      <BlurView intensity={30} tint="default" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={s.glassInner}>{children}</View>
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled,
  variant = "accent",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "accent" | "amber" | "ghost";
}) {
  const bg =
    variant === "accent" ? colors.accent
      : variant === "amber" ? colors.amber
        : colors.transparent;
  const pressedBg =
    variant === "accent" ? colors.accentDark
      : variant === "amber" ? colors.amberDark
        : "rgba(255,255,255,0.06)";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.primaryBtn,
        { backgroundColor: pressed ? pressedBg : bg },
        variant === "ghost" && s.ghostBtn,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text
        style={[
          s.primaryBtnText,
          variant === "ghost" && { color: colors.textSecondary },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ChoiceCard({
  letter,
  title,
  onPress,
  index,
}: {
  letter: string;
  title: string;
  onPress: () => void;
  index: number;
}) {
  const anim = useFadeIn(index * 100, 500);

  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.choiceCard,
          pressed && s.choiceCardPressed,
        ]}
      >
        <BlurView intensity={30} tint="default" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={s.choiceCardInner}>
          <View style={s.choiceBadge}>
            <Text style={s.choiceBadgeText}>{letter}</Text>
          </View>
          <Text style={s.choiceTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={s.choiceArrow}>&rsaquo;</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const anim = useFadeIn(0, 600);

  return (
    <Animated.View style={[s.header, anim]}>
      <Text style={s.headerTitle}>{title}</Text>
      {subtitle ? <Text style={s.headerSubtitle}>{subtitle}</Text> : null}
      <View style={s.headerLine} />
    </Animated.View>
  );
}

function LoadingScreen({ message }: { message: string }) {
  const pulse = usePulse(0.4, 1, 1000);
  return (
    <Screen>
      <View style={s.loadingContainer}>
        <Animated.View style={[s.loadingPulse, { opacity: pulse }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </Animated.View>
        <Text style={s.loadingText}>{message}</Text>
      </View>
    </Screen>
  );
}

function AudioPlayingIndicator({ title }: { title?: string }) {
  const scale = useScalePulse();
  const outerScale = useScalePulse(1, 1.4, 1200);
  const outerOpacity = usePulse(0.1, 0.3, 1200);

  return (
    <View style={s.audioIndicator}>
      <Animated.View style={[s.audioOuterRing, { transform: [{ scale: outerScale }], opacity: outerOpacity }]} />
      <Animated.View style={[s.audioPulseRing, { transform: [{ scale }] }]} />
      <View style={s.audioDot} />
      <Text style={s.audioPlayingText}>{title ?? "Prehrava sa audio..."}</Text>
    </View>
  );
}

function PulsingDot() {
  const opacity = usePulse();
  return <Animated.View style={[s.recordingDot, { opacity }]} />;
}

function VoiceIndicator({
  isRecording,
  isProcessing,
  lastError,
  onStopEarly,
}: {
  isRecording: boolean;
  isProcessing: boolean;
  lastError: string | null;
  onStopEarly: () => void;
}) {
  if (!isRecording && !isProcessing && !lastError) return null;

  return (
    <GlassCard style={s.voiceBar}>
      {isRecording && (
        <View style={s.voiceRow}>
          <PulsingDot />
          <Text style={s.voiceRecText}>
            Nahravám... Povedz "moznost A" alebo "jedna"
          </Text>
          <Pressable onPress={onStopEarly} style={s.voiceStopBtn}>
            <Text style={s.voiceStopBtnText}>Spracuj</Text>
          </Pressable>
        </View>
      )}
      {isProcessing && (
        <View style={s.voiceRow}>
          <ActivityIndicator size="small" color={colors.amber} />
          <Text style={s.voiceProcText}>Rozpoznavam hlas...</Text>
        </View>
      )}
      {lastError && !isRecording && !isProcessing && (
        <Text style={s.voiceErrText}>{lastError}</Text>
      )}
    </GlassCard>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.errorBanner}>
      <Text style={s.errorBannerText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={s.errorRetryBtn}>
          <Text style={s.errorRetryText}>Skus znova</Text>
        </Pressable>
      )}
    </View>
  );
}

function AnimatedPodcastCard({ podcast, index, onPress }: { podcast: any; index: number; onPress: () => void }) {
  const cardAnim = useFadeIn(350 + index * 120, 500);
  return (
    <Animated.View style={cardAnim}>
      <Pressable onPress={onPress} style={({ pressed }) => [s.podcastCard, pressed && s.podcastCardPressed]}>
        <BlurView intensity={30} tint="default" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={s.podcastCardContent}>
          <Text style={s.podcastCardTitle}>{podcast.title}</Text>
          {podcast.description ? (
            <Text style={s.podcastCardDesc} numberOfLines={2}>{podcast.description}</Text>
          ) : null}
          <View style={s.podcastCardBadgeRow}>
            <View style={s.podcastCardBadge}>
              <Text style={s.podcastCardBadgeText}>INTERAKTIVNY</Text>
            </View>
            <View style={[s.podcastCardBadge, { backgroundColor: "rgba(244,162,97,0.15)" }]}>
              <Text style={[s.podcastCardBadgeText, { color: colors.amber }]}>KRIMI</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AnimatedModeToggle({
  voiceMode,
  setVoiceMode,
}: {
  voiceMode: "buttons" | "voice";
  setVoiceMode: (m: "buttons" | "voice") => void;
}) {
  const slideAnim = useRef(new Animated.Value(voiceMode === "buttons" ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: voiceMode === "buttons" ? 0 : 1,
      useNativeDriver: false,
      tension: 68,
      friction: 12,
    }).start();
  }, [voiceMode]);

  const toggleWidth = SCREEN_W - spacing.xl * 2 - spacing.xs * 2 - 2;
  const halfWidth = toggleWidth / 2;

  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, halfWidth],
  });

  const buttonsTextColor = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,1)", "rgba(255,255,255,0.4)"],
  });

  const voiceTextColor = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"],
  });

  return (
    <View style={s.modeToggleOuter}>
      <BlurView intensity={25} tint="default" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      <View style={s.modeToggleInner}>
        <Animated.View
          style={[
            s.modeIndicator,
            {
              width: halfWidth,
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />
        <Pressable onPress={() => setVoiceMode("buttons")} style={s.modeOption}>
          <Animated.Text style={[s.modeOptionText, { color: buttonsTextColor }]}>
            Tlacidla
          </Animated.Text>
        </Pressable>
        <Pressable onPress={() => setVoiceMode("voice")} style={s.modeOption}>
          <Animated.Text style={[s.modeOptionText, { color: voiceTextColor }]}>
            Hlas + Tlacidla
          </Animated.Text>
        </Pressable>
      </View>
    </View>
  );
}

function PodcastSelectionScreen({
  voiceMode,
  setVoiceMode,
  podcasts,
  onSelectPodcast,
}: {
  voiceMode: "buttons" | "voice";
  setVoiceMode: (m: "buttons" | "voice") => void;
  podcasts: any[] | undefined;
  onSelectPodcast: (id: any) => void;
}) {
  const heroAnim = useFadeIn(0, 700);
  const modeAnim = useFadeIn(200, 500);

  return (
    <Screen>
      <Animated.View style={heroAnim}>
        <Text style={s.heroTagline}>INTERAKTIVNE KRIMI PODCASTY</Text>
        <Text style={s.heroTitle}>Pod povrchom</Text>
        <Text style={s.heroSubtitle}>Pribeh riadis ty. Kazde rozhodnutie meni vysledok.</Text>
      </Animated.View>

      <Animated.View style={[s.modeSelector, modeAnim]}>
        <Text style={s.modeSelectorLabel}>REZIM OVLADANIA</Text>
        <AnimatedModeToggle voiceMode={voiceMode} setVoiceMode={setVoiceMode} />
      </Animated.View>

      {podcasts === undefined ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Nacitavam podcasty...</Text>
        </View>
      ) : podcasts.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyStateText}>Zatial nemas ziadne podcasty.</Text>
        </View>
      ) : (
        <View style={s.podcastList}>
          {podcasts.map((p: any, idx: number) => (
            <AnimatedPodcastCard key={p._id} podcast={p} index={idx} onPress={() => onSelectPodcast(p._id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function IntroScreenContent({
  podcast,
  isLoadingAudio,
  isPlayingAudio,
  audioError,
  onStart,
}: {
  podcast: any;
  isLoadingAudio: boolean;
  isPlayingAudio: boolean;
  audioError: string | null;
  onStart: () => void;
}) {
  const cardAnim = useFadeIn(0, 600);
  const btnAnim = useFadeIn(400, 500);

  return (
    <Screen>
      <Animated.View style={cardAnim}>
        <GlassCard style={s.introCard}>
          <Text style={s.introLabel}>PODCAST</Text>
          <Text style={s.introTitle}>{podcast.title}</Text>
          {podcast.description ? <Text style={s.introDesc}>{podcast.description}</Text> : null}
        </GlassCard>
      </Animated.View>

      {isLoadingAudio && <AudioPlayingIndicator title="Nacitavam intro..." />}
      {isPlayingAudio && <AudioPlayingIndicator title="Pocuvaj intro..." />}
      {audioError && <ErrorBanner message={`Chyba audia: ${audioError}`} />}

      <Animated.View style={[s.introActions, btnAnim]}>
        <PrimaryButton
          title="ZACAT VYSETROVANIE"
          disabled={isLoadingAudio || isPlayingAudio}
          onPress={onStart}
        />
      </Animated.View>
    </Screen>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function TestPodcastFlow() {
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [selectedPodcastId, setSelectedPodcastId] = useState<Id<"podcasts"> | null>(null);
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
    session, selectMainBranch, selectSubBranch, finishSubBranch,
    selectAccusation, startInvestigation, finishMainIntro,
    finishAccusationIntro, proceedToAccusations, returnToSubSelection,
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
    session?.currentMainBranchId ? { mainBranchId: session.currentMainBranchId } : "skip"
  );
  const accusations = useQuery(
    api.podcasts.getAccusations,
    session?.podcastId ? { podcastId: session.podcastId } : "skip"
  );

  const currentMainBranchId = session?.currentMainBranchId;
  const selectedSubsForMain = currentMainBranchId
    ? session?.selectedSubBranches[currentMainBranchId] ?? []
    : [];

  const currentState = session?.currentState ?? "";

  const availableMainBranches =
    currentState === "MAIN_SELECTION"
      ? mainBranches?.filter((mb) => !session!.selectedMainBranches.includes(mb._id)) ?? []
      : [];

  const availableSubBranches =
    currentState === "SUB_SELECTION"
      ? subBranches?.filter((sb) => !selectedSubsForMain.includes(sb._id)) ?? []
      : [];

  const currentAccusations =
    currentState === "ACCUSATION_SELECTION" ? accusations ?? [] : [];

  const voiceNumOptions =
    currentState === "MAIN_SELECTION" ? availableMainBranches.length
      : currentState === "SUB_SELECTION" ? availableSubBranches.length
        : currentState === "ACCUSATION_SELECTION" ? currentAccusations.length
          : 0;

  const voiceActive =
    voiceMode === "voice" && voiceNumOptions > 0 &&
    ["MAIN_SELECTION", "SUB_SELECTION", "ACCUSATION_SELECTION"].includes(currentState) &&
    !isPlayingAudio && !isLoadingAudio;

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
              playAudio(result.audioUrl, () => showResult(result.isCorrect), () => showResult(result.isCorrect));
            } else {
              showResult(result.isCorrect);
            }
          }
        }
      } catch (error: any) {
        Alert.alert("Chyba", error.message);
      }
    },
    [session?.currentState, availableMainBranches, availableSubBranches, currentAccusations, selectMainBranch, selectSubBranch, selectAccusation]
  );

  const handleVoiceError = useCallback((transcript: string) => {
    Alert.alert(
      "Nerozpoznal som vyber",
      transcript
        ? `Rozpoznany text: "${transcript}"\n\nPovedz napr. "moznost A" alebo "jedna".`
        : 'Nerozpoznal som nic. Povedz jasne "moznost A", "B" alebo klikni na tlacidlo.'
    );
  }, []);

  const voice = useAutoVoiceRecording({
    active: voiceActive,
    numOptions: voiceNumOptions,
    recognizeFn: recognizeVoiceChoice,
    onChoice: handleVoiceChoice,
    onError: handleVoiceError,
  });

  const showResult = (isCorrect: boolean) => {
    Alert.alert(
      isCorrect ? "Spravne!" : "Nespravne",
      isCorrect ? "Gratulujeme, tvoj tip bol spravny!" : "Bohuzial, tentokrat to nevyslo.",
      [{ text: "OK", onPress: () => { setSessionId(null); setIsCreatingSession(false); } }]
    );
  };

  // ─── Audio ────────────────────────────

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false, staysActiveInBackground: false,
      playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false,
    }).catch((err) => console.warn("Failed to set audio mode", err));
    return () => { soundRef.current?.unloadAsync().catch(console.error); };
  }, []);

  useEffect(() => { audioPlayedKeyRef.current = null; }, [session?.currentState, session?.currentMainBranchId]);

  const playAudio = async (audioUrl: string, onFinished: () => void, onError?: (error: Error) => void) => {
    try {
      setIsLoadingAudio(true); setAudioError(null);
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      setIsLoadingAudio(false); setIsPlayingAudio(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) { setIsPlayingAudio(false); onFinished(); }
        } else if (status.error) {
          setIsLoadingAudio(false); setIsPlayingAudio(false);
          const err = new Error(status.error || "Audio playback error");
          setAudioError(err.message);
          onError ? onError(err) : Alert.alert("Chyba audia", err.message);
        }
      });
    } catch (error: any) {
      setIsLoadingAudio(false); setIsPlayingAudio(false);
      const msg = error.message || "Failed to load audio";
      setAudioError(msg);
      onError ? onError(error) : Alert.alert("Chyba audia", msg);
    }
  };

  // ─── Auto-play effects ────────────────

  useEffect(() => {
    if (session?.currentState === "MAIN_INTRO") {
      const key = `MAIN_INTRO-${session.currentMainBranchId}`;
      if (audioPlayedKeyRef.current === key) return;
      const mb = mainBranches?.find((m) => m._id === session.currentMainBranchId);
      if (mb) {
        audioPlayedKeyRef.current = key;
        playAudio(mb.introAudioUrl,
          () => { finishMainIntro().catch((e) => Alert.alert("Chyba", e.message)); },
          () => { finishMainIntro().catch(console.error); }
        );
      }
      return () => { soundRef.current?.unloadAsync().catch(console.error); };
    }
  }, [session?.currentState, session?.currentMainBranchId, mainBranches, finishMainIntro]);

  useEffect(() => {
    if (session?.currentState === "SUB_PLAYING") {
      const lastSub = selectedSubsForMain[selectedSubsForMain.length - 1];
      const sb = subBranches?.find((s) => s._id === lastSub);
      if (sb) {
        const key = `SUB_PLAYING-${lastSub}`;
        if (audioPlayedKeyRef.current === key) return;
        audioPlayedKeyRef.current = key;
        playAudio(sb.audioUrl,
          () => {
            if (selectedSubsForMain.length === 2) finishSubBranch().catch((e) => Alert.alert("Chyba", e.message));
            else returnToSubSelection().catch((e) => Alert.alert("Chyba", e.message));
          },
          () => {
            if (selectedSubsForMain.length === 2) finishSubBranch().catch(console.error);
            else returnToSubSelection().catch(console.error);
          }
        );
      }
      return () => { soundRef.current?.unloadAsync().catch(console.error); };
    }
  }, [session?.currentState, selectedSubsForMain.length, subBranches, finishSubBranch, returnToSubSelection]);

  useEffect(() => {
    if (session?.currentState === "ACCUSATION_INTRO") {
      const key = "ACCUSATION_INTRO";
      if (audioPlayedKeyRef.current === key) return;
      const url = (podcast as any)?.accusationIntroAudioUrl ?? podcast?.introAudioUrl;
      if (url) {
        audioPlayedKeyRef.current = key;
        playAudio(url,
          () => { finishAccusationIntro().catch((e) => Alert.alert("Chyba", e.message)); },
          () => { finishAccusationIntro().catch(console.error); }
        );
      } else {
        finishAccusationIntro().catch((e) => Alert.alert("Chyba", e.message));
      }
    }
  }, [session?.currentState, podcast, finishAccusationIntro]);

  useEffect(() => {
    if (session?.currentState === "SUB_SELECTION" && selectedSubsForMain.length === 2) {
      finishSubBranch().catch((e) => Alert.alert("Chyba", e.message));
    }
  }, [session?.currentState, selectedSubsForMain.length, finishSubBranch]);

  useEffect(() => {
    if (session?.currentState !== "MAIN_SELECTION") { proceedingRef.current = false; return; }
    const total = mainBranches?.length ?? 0;
    if (total === 0) return;
    const max = Math.floor(total / 2);
    if (session.selectedMainBranches.length >= max && !proceedingRef.current) {
      proceedingRef.current = true;
      proceedToAccusations().catch((e) => { proceedingRef.current = false; Alert.alert("Chyba", e.message); });
    }
  }, [session?.currentState, session?.selectedMainBranches.length, mainBranches?.length, proceedToAccusations]);

  useEffect(() => {
    if (!sessionId && !isCreatingSession && selectedPodcastId) {
      setIsCreatingSession(true);
      createSessionMutation({ podcastId: selectedPodcastId })
        .then((id) => { setSessionId(id); setIsCreatingSession(false); })
        .catch((e) => { Alert.alert("Chyba", e.message); setIsCreatingSession(false); });
    }
  }, [sessionId, isCreatingSession, createSessionMutation, selectedPodcastId]);

  // ═══ RENDER ═════════════════════════════════

  // PODCAST SELECTION
  if (!selectedPodcastId) {
    return (
      <PodcastSelectionScreen
        voiceMode={voiceMode}
        setVoiceMode={setVoiceMode}
        podcasts={podcasts}
        onSelectPodcast={setSelectedPodcastId}
      />
    );
  }

  // INTRO
  if (!session || session.currentState === "INTRO") {
    if (isCreatingSession || podcast === undefined) return <LoadingScreen message="Pripravujem podcast..." />;
    if (podcast === null) return (
      <Screen>
        <ErrorBanner message="Nepodarilo sa nacitat podcast" onRetry={() => { setSessionId(null); setIsCreatingSession(false); }} />
      </Screen>
    );

    return (
      <IntroScreenContent
        podcast={podcast}
        isLoadingAudio={isLoadingAudio}
        isPlayingAudio={isPlayingAudio}
        audioError={audioError}
        onStart={async () => {
          try {
            if (podcast.introAudioUrl && !isLoadingAudio && !isPlayingAudio) {
              await playAudio(podcast.introAudioUrl,
                () => { startInvestigation().catch((e: any) => Alert.alert("Chyba", e.message)); },
                () => { startInvestigation().catch((e: any) => Alert.alert("Chyba", e.message)); }
              );
            } else {
              await startInvestigation();
            }
          } catch (error: any) {
            Alert.alert("Chyba", error.message);
          }
        }}
      />
    );
  }

  // MAIN_SELECTION
  if (session.currentState === "MAIN_SELECTION") {
    const total = mainBranches?.length ?? 0;
    const max = Math.floor(total / 2);
    const canSelectMore = session.selectedMainBranches.length < max;

    if (mainBranches === undefined) return <LoadingScreen message="Nacitavam stopy..." />;

    return (
      <Screen>
        <ScreenHeader title="Vyber stopu" subtitle={`Vybrane: ${session.selectedMainBranches.length} / ${max}`} />
        <VoiceIndicator isRecording={voice.isRecording} isProcessing={voice.isProcessing} lastError={voice.lastError} onStopEarly={voice.stopAndRecognize} />
        {canSelectMore ? (
          <View style={s.choicesContainer}>
            {availableMainBranches.map((branch, idx) => (
              <ChoiceCard key={branch._id} letter={String.fromCharCode(65 + idx)} title={branch.title} index={idx}
                onPress={async () => { try { await selectMainBranch(branch._id); } catch (e: any) { Alert.alert("Chyba", e.message); } }} />
            ))}
          </View>
        ) : (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={s.loadingText}>Prechadzam na obvinenia...</Text>
          </View>
        )}
      </Screen>
    );
  }

  // MAIN_INTRO
  if (session.currentState === "MAIN_INTRO") {
    const mb = mainBranches?.find((m) => m._id === session.currentMainBranchId);
    if (mainBranches === undefined) return <LoadingScreen message="Nacitavam stopu..." />;
    return (
      <Screen>
        <ScreenHeader title="Uvod do stopy" />
        {mb ? (
          <GlassCard>
            <Text style={s.audioCardTitle}>{mb.title}</Text>
            {isLoadingAudio && <AudioPlayingIndicator title="Nacitavam audio..." />}
            {isPlayingAudio && <AudioPlayingIndicator title={mb.title} />}
            {audioError && <ErrorBanner message={`Chyba audia: ${audioError}`}
              onRetry={() => { setAudioError(null); finishMainIntro().catch((e) => Alert.alert("Chyba", e.message)); }} />}
          </GlassCard>
        ) : <ErrorBanner message="Stopa sa nenasla" />}
      </Screen>
    );
  }

  // SUB_SELECTION
  if (session.currentState === "SUB_SELECTION") {
    if (subBranches === undefined) return <LoadingScreen message="Nacitavam podstopy..." />;
    return (
      <Screen>
        <ScreenHeader title="Vyber podstopy" subtitle={`Vybrane: ${selectedSubsForMain.length} / 2`} />
        <VoiceIndicator isRecording={voice.isRecording} isProcessing={voice.isProcessing} lastError={voice.lastError} onStopEarly={voice.stopAndRecognize} />
        {selectedSubsForMain.length < 2 ? (
          <View style={s.choicesContainer}>
            {availableSubBranches.length > 0 ? availableSubBranches.map((branch, idx) => (
              <ChoiceCard key={branch._id} letter={String.fromCharCode(65 + idx)} title={branch.title} index={idx}
                onPress={async () => { try { await selectSubBranch(branch._id); } catch (e: any) { Alert.alert("Chyba", e.message); } }} />
            )) : <Text style={s.emptyStateText}>Ziadne dalsie podstopy k dispozicii.</Text>}
          </View>
        ) : (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={s.loadingText}>Dokoncujem vyber...</Text>
          </View>
        )}
      </Screen>
    );
  }

  // SUB_PLAYING
  if (session.currentState === "SUB_PLAYING") {
    const lastSub = selectedSubsForMain[selectedSubsForMain.length - 1];
    const sb = subBranches?.find((s) => s._id === lastSub);
    if (subBranches === undefined) return <LoadingScreen message="Nacitavam podstopy..." />;
    return (
      <Screen>
        <ScreenHeader title="Pocuvaj stopu" />
        {sb ? (
          <GlassCard>
            <Text style={s.audioCardTitle}>{sb.title}</Text>
            {isLoadingAudio && <AudioPlayingIndicator title="Nacitavam audio..." />}
            {isPlayingAudio && <AudioPlayingIndicator title={sb.title} />}
            {audioError && <ErrorBanner message={`Chyba audia: ${audioError}`}
              onRetry={() => {
                setAudioError(null);
                if (selectedSubsForMain.length === 2) finishSubBranch().catch((e) => Alert.alert("Chyba", e.message));
                else returnToSubSelection().catch((e) => Alert.alert("Chyba", e.message));
              }} />}
          </GlassCard>
        ) : <ErrorBanner message="Podstopa sa nenasla" />}
      </Screen>
    );
  }

  // ACCUSATION_INTRO
  if (session.currentState === "ACCUSATION_INTRO") {
    return (
      <Screen>
        <ScreenHeader title="Obvinenie" subtitle="Koho obvinis?" />
        <GlassCard>
          {isLoadingAudio && <AudioPlayingIndicator title="Nacitavam uvod..." />}
          {isPlayingAudio && <AudioPlayingIndicator title="Uvod k obvineniu..." />}
          {audioError && <ErrorBanner message={`Chyba audia: ${audioError}`}
            onRetry={() => { setAudioError(null); finishAccusationIntro().catch((e) => Alert.alert("Chyba", e.message)); }} />}
        </GlassCard>
      </Screen>
    );
  }

  // ACCUSATION_SELECTION
  if (session.currentState === "ACCUSATION_SELECTION") {
    if (accusations === undefined) return <LoadingScreen message="Nacitavam podozrivych..." />;
    return (
      <Screen>
        <ScreenHeader title="Koho obvinis?" subtitle="Vyber podozriveho" />
        <VoiceIndicator isRecording={voice.isRecording} isProcessing={voice.isProcessing} lastError={voice.lastError} onStopEarly={voice.stopAndRecognize} />
        <View style={s.choicesContainer}>
          {accusations?.map((acc, idx) => (
            <ChoiceCard key={acc._id} letter={String.fromCharCode(65 + idx)} title={acc.suspectName} index={idx}
              onPress={async () => {
                try {
                  const result = await selectAccusation(acc._id);
                  if (result.audioUrl) playAudio(result.audioUrl, () => showResult(result.isCorrect), () => showResult(result.isCorrect));
                  else showResult(result.isCorrect);
                } catch (e: any) { Alert.alert("Chyba", e.message); }
              }} />
          ))}
        </View>
      </Screen>
    );
  }

  // RESULT
  if (session.currentState === "RESULT") {
    return (
      <Screen>
        <ScreenHeader title="Vysledok" />
        {isLoadingAudio && <AudioPlayingIndicator title="Nacitavam vysledok..." />}
        {isPlayingAudio && <AudioPlayingIndicator title="Prehrava sa vysledok..." />}
        {audioError && <ErrorBanner message={`Chyba audia: ${audioError}`} />}
        <PrimaryButton title="Spat na hlavnu obrazovku" variant="ghost"
          onPress={() => { setSessionId(null); setIsCreatingSession(false); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Neznamy stav" subtitle={session ? `Stav: ${session.currentState}` : undefined} />
    </Screen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 6, 12, 0.45)",
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl + 20,
  },

  // Glass card
  glassCardOuter: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderTopColor: "rgba(255,255,255,0.45)",
    ...shadows.card,
  },
  glassInner: {
    padding: spacing.xl,
  },

  // Hero
  heroTagline: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: colors.accent,
    letterSpacing: 3,
    marginTop: spacing.xxxl,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 42,
    fontFamily: fonts.black,
    color: colors.white,
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.45)",
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },

  // Mode selector
  modeSelector: {
    marginBottom: spacing.xxl,
  },
  modeSelectorLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  modeToggleOuter: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderTopColor: "rgba(255,255,255,0.30)",
  },
  modeToggleInner: {
    flexDirection: "row",
    padding: spacing.xs,
  },
  modeIndicator: {
    position: "absolute",
    top: spacing.xs,
    left: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
  },
  modeOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    zIndex: 1,
  },
  modeOptionText: {
    ...typography.button,
    color: "rgba(255,255,255,0.4)",
  },

  // Podcast cards
  podcastList: {
    gap: spacing.md,
  },
  podcastCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderTopColor: "rgba(255,255,255,0.45)",
    ...shadows.card,
  },
  podcastCardPressed: {
    borderColor: "rgba(255,255,255,0.50)",
  },
  podcastCardContent: {
    flex: 1,
    padding: spacing.xl,
  },
  podcastCardTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  podcastCardDesc: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.5)",
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  podcastCardBadgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  podcastCardBadge: {
    backgroundColor: "rgba(230, 57, 70, 0.15)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  podcastCardBadgeText: {
    fontSize: 10,
    fontFamily: fonts.extraBold,
    color: colors.accent,
    letterSpacing: 1,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
  },
  emptyStateText: {
    ...typography.body,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  loadingPulse: {
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: "rgba(255,255,255,0.5)",
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.4)",
    marginTop: spacing.xs,
  },
  headerLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginTop: spacing.md,
  },

  // Choice cards
  choicesContainer: {
    gap: spacing.md,
  },
  choiceCard: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderTopColor: "rgba(255,255,255,0.45)",
    ...shadows.card,
  },
  choiceCardPressed: {
    borderColor: "rgba(255,255,255,0.50)",
  },
  choiceCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
  },
  choiceBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  choiceBadgeText: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.white,
  },
  choiceTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.white,
    flex: 1,
  },
  choiceArrow: {
    fontSize: 28,
    color: "rgba(255,255,255,0.2)",
    marginLeft: spacing.sm,
  },

  // Intro
  introCard: {
    marginBottom: spacing.xl,
  },
  introLabel: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: colors.accent,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  introTitle: {
    fontSize: 26,
    fontFamily: fonts.extraBold,
    color: colors.white,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  introDesc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 21,
  },
  introActions: {
    gap: spacing.md,
  },

  // Audio indicator
  audioIndicator: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  audioOuterRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(230, 57, 70, 0.08)",
    position: "absolute",
    top: spacing.xl,
  },
  audioPulseRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(230, 57, 70, 0.2)",
    position: "absolute",
    top: spacing.xxl - 2,
  },
  audioDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  audioPlayingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "rgba(255,255,255,0.5)",
    marginTop: spacing.lg,
  },

  audioCardTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.white,
    marginBottom: spacing.lg,
  },

  // Voice
  voiceBar: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  voiceRecText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.accent,
    flex: 1,
  },
  voiceStopBtn: {
    backgroundColor: "rgba(230, 57, 70, 0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  voiceStopBtnText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: fonts.bold,
  },
  voiceProcText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.amber,
    flex: 1,
  },
  voiceErrText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.error,
    textAlign: "center",
  },

  // Error
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorBannerText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.error,
    flex: 1,
  },
  errorRetryBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginLeft: spacing.sm,
  },
  errorRetryText: {
    fontSize: 12,
    color: colors.white,
    fontFamily: fonts.bold,
  },

  // Buttons
  primaryBtn: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: fonts.extraBold,
    color: colors.white,
    letterSpacing: 1,
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
});

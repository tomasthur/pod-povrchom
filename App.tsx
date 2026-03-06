import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Switch,
} from 'react-native';
import { useFonts } from 'expo-font';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
} from '@expo-google-fonts/montserrat';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import type { Story, StoryNode } from './stories';
import { stories } from './stories';
import { TestPodcastFlow } from './components/TestPodcastFlow';
import { colors, fonts, spacing, radii, typography, shadows } from './theme';

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error(
    'Missing EXPO_PUBLIC_CONVEX_URL. Set it to your production or desired Convex deployment URL.'
  );
}

const convex = new ConvexReactClient(CONVEX_URL);

type InteractionMode = 'touch' | 'voice';

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  });

  const [useDevEngine] = useState(__DEV__ ? true : false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('touch');

  const selectedStory: Story | null = useMemo(
    () => stories.find((s) => s.id === selectedStoryId) ?? null,
    [selectedStoryId]
  );

  const currentNode: StoryNode | null = useMemo(() => {
    if (!selectedStory) return null;
    const effectiveId = currentNodeId ?? selectedStory.entryNodeId;
    return selectedStory.nodes[effectiveId] ?? null;
  }, [selectedStory, currentNodeId]);

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (__DEV__ && useDevEngine) {
    return (
      <ConvexProvider client={convex}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
          <TestPodcastFlow />
        </SafeAreaView>
      </ConvexProvider>
    );
  }

  const handleStartStory = (storyId: string) => {
    const story = stories.find((s) => s.id === storyId);
    if (!story) return;
    setSelectedStoryId(storyId);
    setCurrentNodeId(story.entryNodeId);
  };

  const handleChooseBranch = (nodeId: string) => {
    setCurrentNodeId(nodeId);
  };

  const handleRestartStory = () => {
    if (!selectedStory) return;
    setCurrentNodeId(selectedStory.entryNodeId);
  };

  const handleExitToHome = () => {
    setSelectedStoryId(null);
    setCurrentNodeId(null);
  };

  const handleToggleInteractionMode = () => {
    setInteractionMode((prev) => (prev === 'touch' ? 'voice' : 'touch'));
  };

  const showHome = !selectedStory || !currentNode;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.appTitle}>Pod povrchom</Text>
        <Text style={styles.appSubtitle}>Interaktivne krimi pribehy v tvojej rezii</Text>

        {showHome ? (
          <HomeScreen stories={stories} onStartStory={handleStartStory} />
        ) : (
          <StoryPlayerScreen
            story={selectedStory}
            node={currentNode}
            interactionMode={interactionMode}
            onToggleInteractionMode={handleToggleInteractionMode}
            onChooseBranch={handleChooseBranch}
            onRestart={handleRestartStory}
            onExit={handleExitToHome}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

type HomeScreenProps = {
  stories: Story[];
  onStartStory: (storyId: string) => void;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ stories, onStartStory }) => {
  return (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Vyber si pripad</Text>
      <FlatList
        data={stories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.storyCard,
              pressed && styles.storyCardPressed,
            ]}
            onPress={() => onStartStory(item.id)}
          >
            <Text style={styles.storyTitle}>{item.title}</Text>
            <Text style={styles.storyDescription}>{item.description}</Text>
            <View style={styles.storyMetaRow}>
              <View style={styles.storyMetaBadge}>
                <Text style={styles.storyMetaBadgeText}>Obtiaznost: {item.difficulty}</Text>
              </View>
              <View style={styles.storyMetaBadge}>
                <Text style={styles.storyMetaBadgeText}>Pilotny diel</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
};

type StoryPlayerScreenProps = {
  story: Story;
  node: StoryNode;
  interactionMode: InteractionMode;
  onToggleInteractionMode: () => void;
  onChooseBranch: (nodeId: string) => void;
  onRestart: () => void;
  onExit: () => void;
};

const StoryPlayerScreen: React.FC<StoryPlayerScreenProps> = ({
  story,
  node,
  interactionMode,
  onToggleInteractionMode,
  onChooseBranch,
  onRestart,
  onExit,
}) => {
  const isEnding = node.type === 'ending';

  return (
    <View style={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{story.title}</Text>
        <Pressable style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitButtonText}>Ukoncit pripad</Text>
        </Pressable>
      </View>

      <View style={styles.modeToggleRow}>
        <Text style={styles.modeLabel}>
          Rezim: {interactionMode === 'touch' ? 'Dotyk' : 'Hlas'}
        </Text>
        <View style={styles.modeSwitch}>
          <Text style={styles.modeSwitchLabel}>Dotyk</Text>
          <Switch
            value={interactionMode === 'voice'}
            onValueChange={onToggleInteractionMode}
            thumbColor={colors.accent}
            trackColor={{ false: colors.surfaceBorder, true: colors.accent }}
          />
          <Text style={styles.modeSwitchLabel}>Hlas</Text>
        </View>
      </View>

      {interactionMode === 'voice' && (
        <Text style={styles.voiceHint}>
          Hlasovy vyber je zatial len koncept. Vetvy mozes docasne vyberat tlacidlami nizsie.
        </Text>
      )}

      <View style={styles.storyBlock}>
        {node.title ? <Text style={styles.nodeTitle}>{node.title}</Text> : null}
        <Text style={styles.nodeText}>{node.text}</Text>

        {isEnding && (
          <View style={styles.endingBadgeRow}>
            <Text style={styles.endingBadge}>
              {node.outcome === 'solved'
                ? 'Pripad vyrieseny'
                : node.outcome === 'unsolved'
                  ? 'Pripad v archive'
                  : 'Slepa ulicka'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionsBlock}>
        {isEnding ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={onRestart}
            >
              <Text style={styles.primaryButtonText}>Zacat pripad odznova</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={onExit}
            >
              <Text style={styles.secondaryButtonText}>Spat na vyber pribehov</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.choicesTitle}>Ako budes pokracovat?</Text>
            {node.choices?.map((choice) => (
              <Pressable
                key={choice.id}
                style={({ pressed }) => [
                  styles.choiceButton,
                  pressed && styles.choiceButtonPressed,
                ]}
                onPress={() => onChooseBranch(choice.leadsTo)}
              >
                <Text style={styles.choiceButtonText}>{choice.label}</Text>
              </Pressable>
            ))}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
  },
  appTitle: {
    ...typography.heroTitle,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  appSubtitle: {
    ...typography.subtitle,
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 20,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  storyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...shadows.card,
  },
  storyCardPressed: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.accent,
  },
  storyTitle: {
    ...typography.body,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  storyDescription: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  storyMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  storyMetaBadge: {
    backgroundColor: colors.accentGlow,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  storyMetaBadgeText: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: fonts.semiBold,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  exitButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  exitButtonText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeSwitchLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  voiceHint: {
    ...typography.caption,
    color: colors.amber,
    marginBottom: spacing.sm,
  },
  storyBlock: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  nodeTitle: {
    ...typography.body,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  nodeText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  endingBadgeRow: {
    marginTop: spacing.md,
  },
  endingBadge: {
    ...typography.badge,
    color: colors.text,
  },
  actionsBlock: {
    gap: spacing.sm,
  },
  choicesTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  choiceButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: spacing.xs,
  },
  choiceButtonPressed: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.accent,
  },
  choiceButtonText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonPressed: {
    backgroundColor: colors.accentDark,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.bg,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surfaceHover,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
});

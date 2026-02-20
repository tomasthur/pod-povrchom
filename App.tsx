import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Switch,
} from 'react-native';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import type { Story, StoryNode } from './stories';
import { stories } from './stories';
// DEV ONLY - Debug screen for testing podcast engine
import { DevPodcastEngineScreen } from './components/DevPodcastEngineScreen';

// Initialize Convex client
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || 'https://warmhearted-snake-507.eu-west-1.convex.cloud';
const convex = new ConvexReactClient(CONVEX_URL);

type InteractionMode = 'touch' | 'voice';

export default function App() {
  // DEV ONLY - Toggle between old story app and dev podcast engine test
  const [useDevEngine, setUseDevEngine] = useState(__DEV__ ? true : false);

  if (__DEV__ && useDevEngine) {
    return (
      <ConvexProvider client={convex}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
          <DevPodcastEngineScreen />
        </SafeAreaView>
      </ConvexProvider>
    );
  }

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
        <Text style={styles.appSubtitle}>Interaktívne krimi príbehy v tvojej réžii</Text>

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
      <Text style={styles.sectionTitle}>Vyber si prípad</Text>
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
              <Text style={styles.storyMetaBadge}>Obtiažnosť: {item.difficulty}</Text>
              <Text style={styles.storyMetaBadge}>Pilotný diel</Text>
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
          <Text style={styles.exitButtonText}>Ukončiť prípad</Text>
        </Pressable>
      </View>

      <View style={styles.modeToggleRow}>
        <Text style={styles.modeLabel}>Režim: {interactionMode === 'touch' ? 'Dotyk' : 'Hlas (príprava)'}</Text>
        <View style={styles.modeSwitch}>
          <Text style={styles.modeSwitchLabel}>Dotyk</Text>
          <Switch
            value={interactionMode === 'voice'}
            onValueChange={onToggleInteractionMode}
            thumbColor="#f97316"
            trackColor={{ false: '#4b5563', true: '#f97316' }}
          />
          <Text style={styles.modeSwitchLabel}>Hlas</Text>
        </View>
      </View>

      {interactionMode === 'voice' && (
        <Text style={styles.voiceHint}>
          Hlasový výber je zatiaľ len koncept. Vetvy môžeš dočasne vyberať tlačidlami
          nižšie – neskôr sem doplníme skutočné rozpoznávanie reči.
        </Text>
      )}

      <View style={styles.storyBlock}>
        {node.title ? <Text style={styles.nodeTitle}>{node.title}</Text> : null}
        <Text style={styles.nodeText}>{node.text}</Text>

        {isEnding && (
          <View style={styles.endingBadgeRow}>
            <Text style={styles.endingBadge}>
              {node.outcome === 'solved'
                ? '✅ Prípad vyriešený'
                : node.outcome === 'unsolved'
                ? '🗃️ Prípad v archíve'
                : '❓ Slepá ulička'}
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
              <Text style={styles.primaryButtonText}>Začať prípad odznova</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={onExit}
            >
              <Text style={styles.secondaryButtonText}>Späť na výber príbehov</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.choicesTitle}>Ako budeš pokračovať?</Text>
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
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#020617',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  storyCard: {
    backgroundColor: '#0b1120',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  storyCardPressed: {
    backgroundColor: '#020617',
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  storyDescription: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 12,
  },
  storyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  storyMetaBadge: {
    fontSize: 11,
    color: '#e5e7eb',
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exitButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  exitButtonText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  modeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeSwitchLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  voiceHint: {
    fontSize: 11,
    color: '#fbbf24',
    marginBottom: 8,
  },
  storyBlock: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    marginBottom: 12,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  nodeText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#d1d5db',
  },
  endingBadgeRow: {
    marginTop: 14,
  },
  endingBadge: {
    fontSize: 13,
    color: '#f9fafb',
  },
  actionsBlock: {
    gap: 8,
  },
  choicesTitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  choiceButton: {
    backgroundColor: '#0b1120',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 4,
  },
  choiceButtonPressed: {
    backgroundColor: '#111827',
  },
  choiceButtonText: {
    fontSize: 14,
    color: '#f9fafb',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#f97316',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  primaryButtonPressed: {
    backgroundColor: '#ea580c',
  },
  primaryButtonText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#020617',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  secondaryButtonPressed: {
    backgroundColor: '#020617',
    opacity: 0.9,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
  },
});


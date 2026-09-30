import { createContext, useContext, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Bell,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  Home,
  Package,
  UserRound,
  X,
} from 'lucide-react-native';
import { theme } from './theme';
import type { PublicUser } from '@medora/shared-types';

const tabs = [
  { name: 'Home', icon: Home },
  { name: 'Prescriptions', icon: ClipboardList },
  { name: 'Orders', icon: Package },
  { name: 'Profile', icon: UserRound },
] as const;
type TabName = (typeof tabs)[number]['name'];
export const FontReadyContext = createContext(true);
export function AppText({
  weight = 'regular',
  style,
  ...props
}: TextProps & { weight?: keyof typeof theme.font }) {
  const ready = useContext(FontReadyContext);
  return (
    <Text
      {...props}
      style={[
        styles.text,
        { fontFamily: ready ? theme.font[weight] : undefined },
        style,
      ]}
    />
  );
}

export function PatientLayout({
  user,
  onLogout,
  signingOut,
}: {
  user: PublicUser;
  onLogout: () => void;
  signingOut: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const active = tabs.find((tab) => tab.name === activeTab)!;
  const ActiveIcon = active.icon;
  function navigate(tab: TabName) {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <HeartPulse size={22} color={theme.colors.card} />
          </View>
          <AppText weight="bold" style={styles.brandName}>
            medora
            <AppText weight="bold" style={styles.brandDot}>
              .
            </AppText>
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => setNotificationsOpen(true)}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <Bell size={22} color={theme.colors.text} />
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <AppText weight="semibold" style={styles.eyebrow}>
            {user.displayName}'s MEDORA
          </AppText>
          <AppText
            accessibilityRole="header"
            weight="semibold"
            style={styles.title}
          >
            {activeTab === 'Home' ? 'Your care,\nin one place.' : activeTab}
          </AppText>
          <AppText style={styles.description}>
            {activeTab === 'Home'
              ? 'A little clarity for your everyday care.'
              : `A dedicated space for your ${activeTab.toLowerCase()}.`}
          </AppText>
        </View>
        {activeTab === 'Home' ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <ClipboardList size={30} color={theme.colors.primary} />
              </View>
              <AppText weight="semibold" style={styles.heroTitle}>
                Stay close to your care
              </AppText>
              <AppText style={styles.description}>
                A simple home for your prescriptions, whenever you need them.
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigate('Prescriptions')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <AppText weight="semibold" style={styles.primaryButtonText}>
                  View prescriptions
                </AppText>
                <ArrowRight size={18} color={theme.colors.card} />
              </Pressable>
            </View>
            <AppText
              accessibilityRole="header"
              weight="semibold"
              style={styles.sectionTitle}
            >
              At your fingertips
            </AppText>
            <View style={styles.card}>
              {(
                [
                  {
                    name: 'Orders',
                    icon: Package,
                    detail: 'A place for your medication orders',
                  },
                  {
                    name: 'Profile',
                    icon: UserRound,
                    detail: 'Your details, together',
                  },
                ] as const
              ).map(({ name, icon: Icon, detail }, index) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${name}`}
                  onPress={() => navigate(name)}
                  style={({ pressed }) => [
                    styles.shortcut,
                    index === 0 && styles.rowBorder,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.smallIcon}>
                    <Icon size={22} color={theme.colors.primary} />
                  </View>
                  <View style={styles.shortcutCopy}>
                    <AppText weight="semibold">{name}</AppText>
                    <AppText style={styles.smallMuted}>{detail}</AppText>
                  </View>
                  <ChevronRight size={19} color={theme.colors.muted} />
                </Pressable>
              ))}
            </View>
            <View style={styles.careNote}>
              <HeartPulse size={18} color={theme.colors.primary} />
              <AppText style={styles.smallMuted}>
                Thoughtfully connected care.
              </AppText>
            </View>
          </>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <View style={styles.emptyIcon}>
              <ActiveIcon size={32} color={theme.colors.primary} />
            </View>
            <AppText weight="semibold" style={styles.emptyTitle}>
              {activeTab === 'Profile'
                ? 'A space that feels like you'
                : `Your ${activeTab.toLowerCase()} will appear here`}
            </AppText>
            <AppText style={styles.emptyDescription}>
              This is a layout preview. No records or actions are connected yet.
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigate('Home')}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <AppText weight="semibold" style={styles.secondaryButtonText}>
                Back to home
              </AppText>
            </Pressable>
          </View>
        )}
        {activeTab === 'Profile' && (
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            style={styles.secondaryButton}
            onPress={onLogout}
          >
            <AppText weight="semibold" style={styles.secondaryButtonText}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </AppText>
          </Pressable>
        )}
        <View style={styles.previewBadge}>
          <AppText weight="medium" style={styles.previewText}>
            Layout preview
          </AppText>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {tabs.map(({ name, icon: Icon }) => (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityLabel={name}
              accessibilityState={{ selected: activeTab === name }}
              onPress={() => navigate(name)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.tabIcon,
                  activeTab === name && styles.tabIconActive,
                ]}
              >
                <Icon
                  size={22}
                  color={
                    activeTab === name
                      ? theme.colors.primary
                      : theme.colors.muted
                  }
                />
              </View>
              <AppText
                weight={activeTab === name ? 'semibold' : 'medium'}
                style={[
                  styles.tabLabel,
                  activeTab === name && styles.tabLabelActive,
                ]}
              >
                {name}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <Modal
        visible={notificationsOpen}
        transparent
        animationType="none"
        onRequestClose={() => setNotificationsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.modalHeader}>
              <AppText
                accessibilityRole="header"
                weight="semibold"
                style={styles.sectionTitle}
              >
                Notifications
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
                onPress={() => setNotificationsOpen(false)}
                style={styles.iconButton}
              >
                <X size={22} color={theme.colors.text} />
              </Pressable>
            </View>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Bell size={30} color={theme.colors.primary} />
              </View>
              <AppText weight="semibold" style={styles.emptyTitle}>
                Your updates, all together
              </AppText>
              <AppText style={styles.emptyDescription}>
                Notifications will appear here. There are no connected updates
                in this preview.
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setNotificationsOpen(false)}
                style={styles.secondaryButton}
              >
                <AppText weight="semibold" style={styles.secondaryButtonText}>
                  Back to my care
                </AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { colors: c, space: s, radius: r, fontSize: f } = theme;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  text: { color: c.text, fontSize: f.body, lineHeight: 24 },
  header: {
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingHorizontal: s.xxl,
    paddingVertical: s.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: s.sm },
  brandIcon: {
    width: 34,
    height: 34,
    backgroundColor: c.primary,
    borderRadius: r.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 27, lineHeight: 34, letterSpacing: -1.3 },
  brandDot: { color: c.primary, fontSize: 27 },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: {
    padding: s.xxl,
    paddingBottom: s.xxxl,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { marginBottom: s.xxl },
  eyebrow: {
    color: c.muted,
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: s.sm,
  },
  title: {
    fontSize: f.title,
    lineHeight: 40,
    letterSpacing: -1.3,
    marginBottom: s.sm,
  },
  description: { color: c.muted, fontSize: f.small, lineHeight: 23 },
  hero: {
    padding: s.xxl,
    backgroundColor: c.primarySoft,
    borderRadius: r.large,
    gap: s.md,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: r.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.sm,
  },
  heroTitle: {
    color: c.primaryDark,
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.md,
    backgroundColor: c.primary,
    padding: s.md,
    borderRadius: r.small,
    marginTop: s.sm,
    flexWrap: 'wrap',
  },
  primaryButtonText: { fontSize: f.small, color: c.card },
  sectionTitle: { fontSize: f.body, marginTop: s.xxl, marginBottom: s.lg },
  card: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r.medium,
    overflow: 'hidden',
  },
  shortcut: {
    flexDirection: 'row',
    gap: s.md,
    alignItems: 'center',
    padding: s.lg,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  smallIcon: {
    width: 40,
    height: 40,
    backgroundColor: c.background,
    borderRadius: r.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutCopy: { flex: 1, gap: s.xs },
  smallMuted: { color: c.muted, fontSize: f.caption, lineHeight: 19 },
  careNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    marginTop: s.xxl,
  },
  previewBadge: {
    alignSelf: 'center',
    marginTop: s.xxl,
    paddingVertical: s.xs,
    paddingHorizontal: s.md,
    backgroundColor: c.blueSoft,
    borderRadius: r.full,
  },
  previewText: { fontSize: f.caption, color: c.secondary },
  bottomBar: {
    backgroundColor: c.card,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  tabs: {
    flexDirection: 'row',
    paddingVertical: s.sm,
    paddingHorizontal: s.sm,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    gap: s.xs,
    paddingVertical: s.xs,
  },
  tabIcon: {
    width: 52,
    height: 30,
    borderRadius: r.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: { backgroundColor: c.primarySoft },
  tabLabel: { color: c.muted, fontSize: f.caption, lineHeight: 18 },
  tabLabelActive: { color: c.primaryDark },
  pressed: { opacity: 0.72 },
  emptyCard: {
    alignItems: 'center',
    padding: s.xxl,
    paddingVertical: s.section,
    gap: s.lg,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.large,
    backgroundColor: c.primarySoft,
  },
  emptyTitle: {
    fontSize: f.subtitle,
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyDescription: { fontSize: f.small, textAlign: 'center', color: c.muted },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: r.small,
    paddingVertical: s.sm,
    paddingHorizontal: s.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: c.primaryDark, fontSize: f.small },
  modalBackdrop: {
    flex: 1,
    backgroundColor: c.overlay,
    padding: s.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: c.card,
    borderRadius: r.large,
    padding: s.lg,
    width: '100%',
    maxWidth: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: s.sm,
  },
});

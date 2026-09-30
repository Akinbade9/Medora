import {
  BookOpen,
  ClipboardList,
  CreditCard,
  Flag,
  Home,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
export type WorkspaceRole = 'doctor' | 'pharmacy' | 'admin';
type NavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
};
type Workspace = {
  label: string;
  shortLabel: string;
  intro: string;
  items: NavigationItem[];
};
export const workspaces: Record<WorkspaceRole, Workspace> = {
  doctor: {
    label: 'Doctor workspace',
    shortLabel: 'Doctor',
    intro: 'A little more clarity. More room for care.',
    items: [
      {
        id: 'home',
        label: 'Home',
        icon: Home,
        description: 'Your workspace, brought together.',
      },
      {
        id: 'patients',
        label: 'Patients',
        icon: Users,
        description: 'A dedicated space for the people in your care.',
      },
      {
        id: 'prescriptions',
        label: 'Prescriptions',
        icon: ClipboardList,
        description: 'Keep prescription information in one place.',
      },
      {
        id: 'feedback',
        label: 'Feedback',
        icon: MessageSquare,
        description: 'A place for questions and follow-up.',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: UserRound,
        description: 'Your professional details and preferences.',
      },
    ],
  },
  pharmacy: {
    label: 'Pharmacy workspace',
    shortLabel: 'Pharmacy',
    intro: 'An organized workspace for everyday care.',
    items: [
      {
        id: 'home',
        label: 'Home',
        icon: Home,
        description: 'Your workspace, brought together.',
      },
      {
        id: 'orders',
        label: 'Orders',
        icon: Package,
        description: 'A central place for pharmacy orders.',
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: ClipboardList,
        description: 'A clear view of your medicine inventory.',
      },
      {
        id: 'payments',
        label: 'Payments',
        icon: Wallet,
        description: 'Your payment information, organized.',
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: UserRound,
        description: 'Your pharmacy details and preferences.',
      },
    ],
  },
  admin: {
    label: 'Platform Admin workspace',
    shortLabel: 'Platform Admin',
    intro: 'A clear foundation for a trusted care network.',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        description: 'Your workspace, brought together.',
      },
      {
        id: 'verifications',
        label: 'Verifications',
        icon: ShieldCheck,
        description: 'A dedicated space for verification reviews.',
      },
      {
        id: 'accounts',
        label: 'Accounts',
        icon: Users,
        description: 'A central place for platform accounts.',
      },
      {
        id: 'orders-transactions',
        label: 'Orders & Transactions',
        icon: CreditCard,
        description: 'An overview of platform activity.',
      },
      {
        id: 'complaints',
        label: 'Complaints',
        icon: MessageSquare,
        description: 'A place to review reported concerns.',
      },
      {
        id: 'flags-audits',
        label: 'Flags & Audits',
        icon: Flag,
        description: 'A dedicated space for platform oversight.',
      },
      {
        id: 'medicine-catalogue',
        label: 'Medicine Catalogue',
        icon: BookOpen,
        description: 'A home for structured medicine information.',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        description: 'Platform preferences, in one place.',
      },
    ],
  },
};
export function parseRoute(hash: string): {
  role: WorkspaceRole;
  page: string;
} {
  const [, candidate, page] = hash.replace(/^#/, '').split('/');
  const role: WorkspaceRole =
    candidate === 'pharmacy' || candidate === 'admin' ? candidate : 'doctor';
  const workspace = workspaces[role];
  const validPage =
    page === 'components' || workspace.items.some((item) => item.id === page);
  return { role, page: validPage && page ? page : workspace.items[0]!.id };
}

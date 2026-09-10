import { MembersScreen, MemberDetail } from './MembersScreens';
import { LoansScreen } from './LoansScreen';
import { MeetingsScreen, MeetingDetail } from './MeetingsScreen';
import { MoreScreen, ReportsScreen, LedgerScreen, SettingsScreen } from './MoreScreens';
import { ContributionsScreen } from './ContributionsScreen';
import { RotationScreen } from './RotationScreen';
import { ProjectsScreen } from './ProjectsScreen';

// name -> { title, Component }. 'home' is handled directly by the shell.
export const SCREENS = {
  members: { title: 'Members', Component: MembersScreen },
  member_detail: { title: 'Member', Component: MemberDetail },
  loans: { title: 'Loans', Component: LoansScreen },
  collections: { title: 'Collections', Component: ContributionsScreen },
  meetings: { title: 'Meetings & Voting', Component: MeetingsScreen },
  meeting_detail: { title: 'Meeting', Component: MeetingDetail },
  more: { title: 'More', Component: MoreScreen },
  reports: { title: 'Reports', Component: ReportsScreen },
  ledger: { title: 'Ledger', Component: LedgerScreen },
  settings: { title: 'Settings', Component: SettingsScreen },
  rotation: { title: 'Merry-Go-Round', Component: RotationScreen },
  projects: { title: 'Chama Projects', Component: ProjectsScreen },
};

// Bottom-nav tabs. `key` doubles as the root screen name.
export const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'members', label: 'Members' },
  { key: 'loans', label: 'Loans' },
  { key: 'meetings', label: 'Meet' },
  { key: 'more', label: 'More' },
];

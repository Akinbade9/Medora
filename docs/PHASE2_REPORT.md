# Phase 2: Design system and base layouts

Implemented only Phase 2 from `MEDORA_SPEC.md`, with the colors and navigation specified in the request. The specification, API, shared types, validation workspace, and existing tests are unchanged. No authentication, database connections, clinical operations, or other business logic were added.

## What is included

- Web theme tokens for colors, spacing, typography, radii, and dialog shadow. Matching native tokens live in the mobile app.
- Locally bundled Inter fonts and Lucide icons. No remote font service is required at runtime.
- Reusable `Button`, `Input`, `Select`, `Card`, `Modal`, `Badge`, `StatusBadge`, `EmptyState`, `LoadingState`, and `ErrorState` exports in `apps/web-dashboard/src/components/ui.tsx`.
- Doctor, Pharmacy, and Platform Admin layouts using a shared sidebar/header shell and role-specific navigation definitions. All requested sidebar destinations have placeholder screens.
- A prominent Doctor **+ New Prescription** action that opens a preview dialog only.
- A labelled **Preview workspace** selector and **UI components** gallery for inspecting all layouts and components.
- Responsive web navigation, hash links with browser history, page titles, a skip link, keyboard focus styles, labelled inputs and errors, native modal focus containment/restoration and Escape handling, and reduced-motion support.
- Patient Home, Prescriptions, Orders, and Profile bottom tabs; a header notification bell opens a placeholder modal. Safe areas and a scrollable content region keep the bottom navigation separate from the content.
- Native font loading state and device-font fallback if font loading fails.

All inputs, navigation, and dialogs affect local preview state only. There are no connected records, API requests, or saved changes.

## New dependencies

| Package                          | Workspace      | Purpose                                       |
| -------------------------------- | -------------- | --------------------------------------------- |
| `@fontsource/inter`              | Web            | Bundle Inter font files locally               |
| `lucide-react`                   | Web            | Consistent React icons                        |
| `@expo-google-fonts/inter`       | Patient mobile | Bundle Inter font assets                      |
| `expo-font`                      | Patient mobile | Load the bundled native fonts                 |
| `lucide-react-native`            | Patient mobile | Matching native icons                         |
| `react-native-svg`               | Patient mobile | Render Lucide's native SVG icons              |
| `react-native-safe-area-context` | Patient mobile | Insets for device cutouts and home indicators |

Native dependency versions were selected from Expo SDK 57's bundled module compatibility list. `package-lock.json` records the resolved packages. The existing React Native Web dependencies were retained. No routing, authentication, data, or payment libraries were added.

## Verification

- ESLint passed.
- TypeScript checks passed for all five workspaces.
- All five existing API integration tests passed.
- Prettier check and web production build passed.
- Web dashboard started at `http://127.0.0.1:5174`; the HTML and transformed React entry module returned HTTP 200.
- Patient Expo Metro started at port 8082; `/status` returned `packager-status:running`.
- Patient Android and iOS Hermes bundles and the web bundle exported successfully, including the four bundled Inter font weights. The export used approved compiler permissions required on this Windows machine.
- Checked seven normal-text color pairs: all exceeded 4.5:1 contrast. Ratios included 15.55:1 for primary text, 6.31:1 for muted text, 5.47:1 for the teal primary button, and 4.75:1 for blue badge text.

The usual ports 5173 and 8081 were occupied, so verification used temporary ports without changing app defaults or stopping the existing processes. The temporary verification servers were stopped afterward.

Browser automation returned no available browsers, so rendered visual inspection, responsive interaction, and keyboard focus behavior have not been manually verified. Native device/emulator rendering and screen-reader behavior also remain unverified. The app source includes the accessibility behavior described above; startup, type checks, and bundling are not a substitute for those manual checks.

The final dependency installation reported 10 moderate audit findings, consistent with the prior Expo toolchain limitation. No forced dependency upgrades or unrelated audit fixes were made.

## Exact file list

Modified:

```text
README.md
package-lock.json
apps/web-dashboard/package.json
apps/web-dashboard/src/App.tsx
apps/web-dashboard/src/main.tsx
apps/web-dashboard/src/styles.css
apps/patient-mobile/package.json
apps/patient-mobile/App.tsx
```

Created:

```text
apps/web-dashboard/src/theme.css
apps/web-dashboard/src/components/ui.tsx
apps/web-dashboard/src/layouts/DashboardLayout.tsx
apps/web-dashboard/src/layouts/navigation.ts
apps/web-dashboard/src/screens/WorkspaceScreen.tsx
apps/web-dashboard/src/screens/ComponentGallery.tsx
apps/patient-mobile/src/theme.ts
apps/patient-mobile/src/PatientLayout.tsx
docs/PHASE2_REPORT.md
```

Generated dependencies, build output, and Expo caches are ignored by Git. No secrets, commits, or changes to unrelated project files were made.

## Try the layouts

Dependencies are installed. Start each app in its own terminal:

```powershell
npm.cmd run dev:web
npm.cmd run dev:mobile
```

On the web, visit `/#/doctor/home`, `/#/pharmacy/home`, or `/#/admin/overview`. The sidebar's **UI components** link opens the gallery. Test the modal using Tab, Shift+Tab, Escape, and its close button. At a narrow viewport, use **Open navigation** to reveal the sidebar links.

For patient mobile, use an Expo Go version compatible with SDK 57 or an Android emulator. Tap each bottom tab and the header bell. Device checks should include large text and safe-area spacing.

If the default ports are still occupied, use:

```powershell
npm.cmd run dev --workspace @medora/web-dashboard -- --port 5174
npm.cmd exec --workspace @medora/patient-mobile -- expo start --port 8082
```

Repeat checks with `npm.cmd run check` and `npm.cmd run build --workspace @medora/web-dashboard`.

To repeat patient bundling checks:

```powershell
npm.cmd exec --workspace @medora/patient-mobile -- expo export --platform android --platform ios --platform web
```

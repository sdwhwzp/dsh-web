# Agent Note: narrow-screen drawer hits land on the drawer, not the frame

English | [中文](2026-11-06-mobile-drawer-hit-testing.zh.md)

Status: implemented

## Problem

Below 768px, and never under the Windows desktop titlebar ([mobile eligibility note](2026-11-16-compat-mobile-eligibility-mirrors-official-drawer.md), #2054), the aggregate compat layer turns the sidebar column into a floating drawer: the `[data-pane="sidebar"]` rules in `RESPONSIVE_CSS` position it absolutely, give it `z-index: 1100`, and paint a `::after` mask at `z-index: 1050` over the frame. The drawer and its dimming were verified visually, never as a hit target.

The official layout has a drawer mode of its own. `.frame[data-sidebar-drawer] .sidebarCol` ships `position: absolute; z-index: 71` and `.drawerMask` ships `z-index: 70`, and the ui-layout client module injects that stylesheet at runtime through `document.head.appendChild`, i.e. after the compat tag. The compat selector `[data-dsh-frame] [data-pane="sidebar"]:is([data-pane="sidebar"])` and the official `.frame[data-sidebar-drawer] .sidebarCol` are both 0-3-0, so the cascade resolves the tie on document order: the officially injected sheet won every plain declaration. `position` survived only because it carried `!important`; `z-index: 1100` did not, so the drawer computed **71**. The compat mask, unimportantly declared at 1050 and left interactive, then painted over the drawer it was dimming.

A pseudo-element's hit reports its originating element, so `document.elementFromPoint` inside the open drawer answered the frame. The reported shape was exactly that: the drawer visible, its rows unresponsive behind a grey cast, and the drawer folding on the first tap because the tap landed on the mask and the dismiss handler folded it (#2013). The phone mirror reported the same interaction through the remote package (#2012/#2014): there the aggregate mask was present too, while `mobile-adapt.ts`'s `ADAPT_CSS` declared no drawer layer at all and silently inherited whatever the official sheet happened to put on top.

## Decision

The layer contract is decided by the declaration that owns it, not by the order two injected stylesheets load in.

`packages/dsh-web-all/src/client/index.ts` keeps the 0-3-0 selector ceiling and uses `position: absolute !important` to keep skin styles from returning the drawer to the grid. The fallback frame gets `z-index: 1100 !important` for its drawer and `z-index: 1050` for its mask. Both layer rules exclude `[data-sidebar-drawer]` and `[data-mobile-nav]` through a zero-specificity guard. The native drawer and `dsh-web-mobile` each retain their own stacking order, which lets host settings dialogs receive clicks above the drawer.

The same zero-specificity technique carries the desktop-titlebar guard: every mobile rule is prefixed with `:where(html:not([data-windows-titlebar]))`, so the whole mobile contract steps aside on the Windows desktop shell without moving the 0-3-0 ceiling ([eligibility note](2026-11-16-compat-mobile-eligibility-mirrors-official-drawer.md)).

The compat mask stays as the drawer's dimming and never becomes a hit surface: `pointer-events: none` on the same `::after`. Dismissal keeps its two existing owners, unchanged: the official `.drawerMask` that the layout paints under its own drawer, and the capture-phase click handler in `installMobileSidebarDismiss` that folds the drawer on any click outside the sidebar ([the 1716 dismissal note](2026-09-25-issue-batch-1716-1719-and-ci-unblock.md)), while also yielding immediately (`if (sidebar !== null && sidebar.closest('[data-mobile-nav]') !== null) return`) whenever `dsh-web-mobile` owns the frame so its capture listener never intercepts taps meant for the mobile plugin's drawer or backdrop.

`packages/dsh-remote-web-ui/src/client/mobile-adapt.ts` states the same ladder in `ADAPT_CSS`: `[class*="_sidebarCol"]{z-index:1100 !important}` and `[class*="_drawerMask"]{z-index:1050 !important}`. The portrait surface therefore does not depend on the aggregate compat sheet — this package also ships alone — and the official dimming stays under the drawer it dims and above the content it darkens. No node is portalled: both layers stay where React owns them.

## Verification

`packages/dsh-web-all/tests/responsive-contract.spec.ts` checks the fallback layers, the inert mask and the native and mobile navigation guards. `tests/e2e/settings-width.e2e.ts` opens settings through the packed aggregate on the real host at 390px and 1440px. `packages/dsh-remote-web-ui/tests/mobile-adapt.spec.ts` checks the standalone adaptation's layer rules.

The original hit-test investigation measured five drawer row centers in Chromium at 390x844. It loaded the compat and official layout sheets in serving order, followed by the standalone remote adaptation where enabled.

| Sheets installed | Drawer `z-index` | Compat mask | Rows hit by `elementFromPoint` |
| --- | --- | --- | --- |
| Original compat + remote | 71 | 1050, interactive | 0/5 |
| Original compat only | 71 | 1050, interactive | 0/5 |
| Original remote only | 71 | absent | 5/5 |
| Inert mask with raised layer, compat + remote | 1100 | 1050, inert | 5/5 |
| Inert mask with raised layer, compat only | 1100 | 1050, inert | 5/5 |
| Inert mask with raised layer, remote only | 1100 | absent (official 1050) | 5/5 |

In the three historical inert-mask runs, backdrop clicks landed on the official `.drawerMask`.

## Alternatives considered

Portal the drawer and the mask to `body` (one of the issue's suggestions). Rejected: the compat layer writes attributes only and must not move React-owned nodes — re-parenting the sidebar column breaks the layout's `insertBefore`/`removeChild` anchors, and `inset`/animation contracts are written against the frame as containing block.

Make the frame leave the hit path while the drawer is open (`pointer-events: none` on `[data-dsh-frame]`), also suggested in the issue. Rejected: the drawer is a descendant of the frame, so the frame's hit suppression freezes the drawer with it, and it would change the hit surface of every plugin mounted inside the frame.

Give the frame `z-index: 0` / `isolation: isolate` so it stops outranking the drawer. Rejected: that keeps the decision inside an order-dependent tie. Any later sheet that declares a layer would re-open the same failure, and the compat layer must keep working beside sheets it does not control.

Raise the ladder to the reporter's probe numbers (`2147483001` / `2147483000`) instead. Rejected: those are the timers a reporter picked to debug, not a boundary. The aggregate already owns one deliberate ceiling (0-3-0) and a caption that a future skin outranking it is that skin's bug; a second ad-hoc number scale would turn the arms race into numeric inflation.

Leave the mask interactive and only fix the drawer's layer. Rejected: the row hit test would then pass, but the dimming would still answer every tap meant for the conversation underneath (the same shape #1829 fixed inside the composer), and a stale mask on a profile whose official drawer is not mounted would be the only thing closing the drawer.

## Consequences

Fallback drawers paint above their dimming. Native drawers keep the official stacking order, including their position below host dialogs. The compat dimming leaves pointer input available to the frame's content and the existing dismissal handlers.

The aggregate commits its built `lib/`, so the compat half reaches a page only after `pnpm build` refreshes it: `pnpm libs:check` reports the committed output as stale until `pnpm libs:write` re-records the fingerprints, and that rebuild is part of shipping this change, not an optional extra.

The remaining ceiling is unchanged: a skin whose rule outranks 0-3-0 still wins, and the correct repair is still that skin, not this rule.

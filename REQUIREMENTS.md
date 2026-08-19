# UX Requirements — Quick Measure Mapping & Visibility Controls

**Author:** UX Product Designer | **Last updated:** April 2026  
**Scope:** Two workflows within the 2D Takeoff app: (1) Quick Measure → Key Measure mapping, (2) visibility controls.

---

## 1. Quick Measure → Key Measure Mapping

### 1.1 User Goal

Organize rough on-canvas measurements into the project's formal cost-code structure, without leaving the measurement list context.

### 1.2 Entry Points

| # | Trigger | Where | When visible | Use case | Notes |
|---|---------|-------|-------------|----------|-------|
| E1 | "Assign" button | Right panel, inline on measurement row | On row hover (replaces dimensions) | Assign a single item during line-by-line review | |
| E2 | "Assign Selected" button | Right panel, bulk action bar | When ≥ 1 checkbox is checked | Assign a batch to the same Key Measure + Section | |

### 1.3 Selection & Bulk Actions

| # | Element | Behavior | Notes |
|---|---------|----------|-------|
| S1 | Row checkbox | Toggles individual measurement into/out of selection | |
| S2 | "Select All" toggle | Selects or deselects all visible measurements | Label switches between "Select All" / "Deselect All" |
| S3 | Bulk action bar | Slides in above list when ≥ 1 item selected | Shows: "N selected", clear (×), "Assign Selected", delete icon |
| S4 | Post-assignment clear | All checkboxes deselected after successful apply | |

### 1.4 Assignment Popover

| # | Aspect | Requirement | Notes |
|---|--------|-------------|-------|
| A1 | Format | Popover (not modal) — measurement list stays visible behind it | Keeps spatial context |
| A2 | Positioning | Anchored near trigger button; prefers left side, flips if no room; clamped to viewport | |
| A3 | Dismiss | Click outside to close; Cancel button; × in header | No confirmation needed — action is non-destructive |
| A4 | Context summary | Shows count + names of measurements being assigned | Truncated if long |
| A5 | Key Measure field | Required. Searchable dropdown. Each option shows name + category. Selected state shows name + clear (×) | |
| A6 | Section field | Optional. Same searchable dropdown pattern | Can be left empty |
| A7 | Apply button | Disabled until Key Measure is selected. No "are you sure" step | |
| A8 | Success feedback | Toast notification; popover closes; selection cleared; left panel refreshes | |

### 1.5 Re-assignment Rules

| # | Scenario | Behavior | Notes |
|---|----------|----------|-------|
| R1 | Assign to a new Key Measure | Creates additional mapping (many-to-many) | A measurement can belong to multiple Key Measures |
| R2 | Assign to same Key Measure again | Upserts — updates Section if changed, no duplicate created | |

### 1.6 Post-Assignment Feedback

| # | Location | Indicator | Interaction | Notes |
|---|----------|-----------|-------------|-------|
| F1 | Right panel row | Green link icon (↔) | Single KM: hover highlights, click pins/unpins. Multiple KMs: click opens popover (see F4) | Badge shows count when > 1 |
| F2 | Left panel row | Green link icon (↔) | Hover shows tooltip with measurement name | Only for assignments originating from Quick Measures panel |
| F3 | Cross-panel | Highlighting targets a **specific assignment row** in the left panel, not all rows for that measurement | Emerald tint + ring on the single targeted row | |

### 1.7 Multi-Assignment Link Popover

When a Quick Measure is assigned to **multiple** Key Measures, the link icon behavior changes from a simple hover to an interactive popover.

| # | Aspect | Requirement | Notes |
|---|--------|-------------|-------|
| F4 | Trigger | Click the link icon (which shows a count badge) | Hover alone does not open the popover for multi-assignment items |
| F5 | Popover content | "Assigned to" header + a row for each Key Measure | Each row has a Layers icon + KM name |
| F6 | Hover within popover | Hovering a KM row highlights **that specific** assignment row in the left panel | Only one row highlighted at a time; user can scan through them |
| F7 | Click within popover | Clicking a KM row **pins** the highlight and closes the popover | Highlight persists while user moves their attention to the left panel |
| F8 | Dismiss | Click outside the popover clears the highlight and closes it | |
| F9 | Problem solved | User no longer loses the highlight when moving from the link icon to the left panel | Pinning is the key mechanism — highlight survives the mouse move |

---

## 2. Visibility Controls

### 2.1 User Goal

Manage visual clutter on a dense takeoff sheet — hide individual items for focused work, or sweep away entire categories temporarily — without losing track of what exists.

### 2.2 Two-Layer Model

| Layer | Scope | Persists? | Control surface | Notes |
|-------|-------|-----------|----------------|-------|
| Per-item toggle | One measurement | Yes (saved to DB) | Eye icon in side panels | User's deliberate intent |
| Canvas filters | Groups by source / type / section | No (session only, resets on reload) | Legend panel on canvas | Temporary viewing aid |

A measurement is drawn on canvas only when it passes **both** layers.

### 2.3 Per-Item Visibility Toggle

| # | Aspect | Requirement | Notes |
|---|--------|-------------|-------|
| V1 | Locations | Eye icon on every row in left panel + right panel; also in right panel's ellipsis menu ("Hide"/"Show") | |
| V2 | Feedback | Optimistic — icon changes immediately, DB update in background | |
| V3 | Works during filtering | Toggling works even on items hidden by canvas filters | Lets user pre-set visibility for when filter is cleared |

#### Visual States

| # | Condition | Eye icon | Row treatment | Tooltip | Notes |
|---|-----------|----------|--------------|---------|-------|
| V4 | Visible | Eye, colored to match measurement | Normal | "Hide markup" | |
| V5 | Hidden by user | EyeOff, gray | Normal | "Show markup" | |
| V6 | Hidden by canvas filter | EyeOff, gray | Entire row at 45% opacity | "Hidden by canvas filter" | Regardless of user toggle state |

### 2.4 Canvas Filter Legend

| # | Aspect | Requirement | Notes |
|---|--------|-------------|-------|
| L1 | Location | Bottom-right corner of canvas | Out of the way of blueprint content |
| L2 | Collapsed state | Pin icon + "Legend" + chevron; shows N/M count if filters active | Persistent reminder that filtering is on |
| L3 | Sections | Divided into: Source, Type, Section, Footer | Separated by dividers |

#### Source Filters (show/hide toggles)

All default to **ON**. Independent — any combination valid. AND logic (must pass all to appear on canvas).

| # | Filter | What it controls | Default | Icon | Notes |
|---|--------|-----------------|---------|------|-------|
| L4 | Key Measures | Measurements with at least one assignment | ON | Layers | |
| L5 | Quick Measures | Measurements with no assignments | ON | Eye | |
| L6 | Auto-Takeoff | Measurements where isAI = true | ON | Sparkles | |

**Visual treatment:**

| State | Icon | Label | Row | Design rationale | Notes |
|-------|------|-------|-----|-----------------|-------|
| ON (default) | Eye, subtle gray | Normal | Quiet, neutral | Default state shouldn't demand attention | |
| OFF | EyeOff, faded | Strikethrough, dimmed | Draws attention | User's eye goes to what's different from normal | |

#### Type Filters (inclusive select)

Default: **nothing selected = all shown**. Selecting types restricts canvas to those types only.

| # | Type | Color dot | Icon | Notes |
|---|------|-----------|------|-------|
| L7 | Area | Green (#10B981) | Square | |
| L8 | Linear | Orange (#F97316) | Dash | |
| L9 | Count | Amber (#F59E0B) | Circle | |

**Visual treatment:** Ring/dot indicator (not eye icon) — different affordance signals different semantics ("filter to" vs. "show/hide").

| State | Indicator | Label | Notes |
|-------|-----------|-------|-------|
| Not selected (default) | Empty ring | Normal | |
| Selected | Filled gray dot | Bold | |

#### Section Filter

| # | Aspect | Requirement | Notes |
|---|--------|-------------|-------|
| L10 | Format | Dropdown multi-select with checkboxes | |
| L11 | Default | No selection = all sections shown | Same inclusive logic as Type |
| L12 | Quick actions | "Select All" / "Clear" at bottom of dropdown | |
| L13 | Count | Each section shows its measurement count | |

#### Footer

| # | Aspect | Requirement | Notes |
|---|--------|-------------|-------|
| L14 | Visibility | Only shown when filters are active | |
| L15 | Content | "N of M visible" + Reset button | Reset returns all filters to defaults |

### 2.5 Side Panels During Filtering

| # | Requirement | Rationale | Notes |
|---|-------------|-----------|-------|
| P1 | Panels always show the full measurement list | Removing items would lose context; user might think items were deleted | |
| P2 | Filtered-out items are dimmed (45% opacity) | Visual cue that items exist but aren't on canvas right now | |
| P3 | Toggles still work on dimmed items | User can pre-set visibility for when filter is removed | |

---

## 3. Hover Highlighting

| # | Trigger | Canvas behavior | Panel behavior | Notes |
|---|---------|----------------|----------------|-------|
| H1 | Hover measurement row in either panel | Spotlights that markup — full color, thick stroke, floating label (name + value + unit) | Hovered row gets blue tint | |
| H2 | (same) | All other markups fade to uniform low-opacity gray | | |
| H3 | Hover hidden measurement | Canvas temporarily reveals it | | Lets user identify which area a hidden measurement covers |
| H4 | Hover ends | Canvas returns to normal state | | |

---

## 4. State Matrix (QA Reference)

| User toggle | Canvas filter | Canvas | Panel row | Eye icon | Notes |
|-------------|--------------|--------|-----------|----------|-------|
| Shown | Passes | ✅ Drawn | Full opacity | Colored eye | |
| Shown | Filtered out | ❌ Not drawn | 45% opacity | Gray eye-off | Tooltip: "Hidden by canvas filter" |
| Hidden | Passes | ❌ Not drawn | Full opacity | Gray eye-off | Tooltip: "Show markup" |
| Hidden | Filtered out | ❌ Not drawn | 45% opacity | Gray eye-off | Tooltip: "Hidden by canvas filter" |
| Any | Any + hovered | ✅ Temp drawn | Highlighted | Unchanged | |

---

## 5. Design Decisions Log

| # | Decision | Rationale | Notes |
|---|----------|-----------|-------|
| D1 | Popover, not modal, for assignment | Keeps measurement list visible; lighter interaction | |
| D2 | Anchor popover near trigger | Reduces eye travel; spatial context | |
| D3 | Inline "Assign" on hover, not always visible | Keeps rows clean when not assigning | |
| D4 | Two independent visibility layers | Per-item = persistent intent; filters = temporary aid; conflating creates confusion | |
| D5 | Filtered items dimmed, not removed | Prevents "where did my items go"; allows pre-toggling | |
| D6 | Quiet default state in legend | All filters ON by default — highlighting the default wastes attention | |
| D7 | Eye icon for source toggles, dot for type | Different semantics deserve different affordances | |
| D8 | Hover reveals hidden items on canvas | Lets user identify spatial location without toggling | |
| D9 | Filters don't persist across sessions | Filters are a temporary lens, not saved configuration | |
| D10 | No confirmation on assign | Non-destructive action; can be re-done or overwritten | |

# v19 — internal section builder (TsLAB-oriented runtime)

## What changed

- Custom modules now carry a real internal layout in `workspace_custom_modules.metadata`.
- New runtime supports section columns and block spans, so the page is assembled from:
  - KPI panels
  - dense tables
  - operational forms
  - action button clusters
- New editor is available inside `/dashboard/custom/[slug]` for admins.
- New modules start with a ready v19 scaffold instead of an empty placeholder.

## Storage model

Metadata is normalized into a compact JSON structure:

- `eyebrow`
- `statusLine`
- `summary`
- `sections[]`
  - `title`
  - `description`
  - `columns`
  - `blocks[]`
    - `type`
    - `span`
    - `tone`
    - type-specific payload

## New flow

1. Create a custom section in the meta-builder.
2. Open the section route.
3. Assemble internal blocks and section layout.
4. Save metadata back into the custom module.
5. Use the module as a real runtime screen for the team.

## Why this is closer to TsLAB

The visual language is intentionally denser and more operational:

- tighter panel rhythm
- flatter command surfaces
- stronger grid feeling
- less “marketing SaaS” card softness
- more control-room / workstation behavior

## Logical v20 continuation

- drag-and-drop reordering inside the internal builder
- reusable presets/templates per department
- live data binding from Supabase queries
- action wiring for form submits and button commands
- saved named views / operator modes


## Inline meta-layer patch

The v19 builder is now also visible directly inside `/dashboard/spaces`.

- custom section cards expose a dedicated builder button
- the selected section opens the full internal builder inline
- admins can keep the topology view and the inner layout editor on the same screen

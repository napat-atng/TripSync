---
name: TripSync
description: A shared trip planning workspace that makes group decisions easy to read.
colors:
  ink: "#183540"
  muted: "#526b72"
  primary: "#146a70"
  primary-deep: "#0d5158"
  primary-soft: "#e7f2ee"
  line: "#d9e2dd"
  paper: "#fffefa"
  ground: "#f3f5ef"
  sun: "#efbb56"
  sun-soft: "#fff5d9"
  danger: "#a33f39"
typography:
  display:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "clamp(3.1rem, 5.5vw, 5.8rem)"
    fontWeight: 800
    lineHeight: 1.09
  heading:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "clamp(2rem, 3.5vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1.21
  body:
    fontFamily: "Noto Sans Thai, Leelawadee UI, Tahoma, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.7
rounded:
  control: "8px"
  surface: "14px"
spacing:
  tight: "8px"
  regular: "16px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.control}"
    height: "46px"
---

# Design System: TripSync

## Overview

**Creative North Star: “สมุดนัดทริป” (Journey Notebook).** TripSync should feel like a clear, friendly place where friends settle a plan together. The interface leads with the current decision, shows who has answered, and keeps setup and management nearby without competing for attention.

**Key Characteristics:** Deep ink framing, warm yellow for invitations to act, quiet paper surfaces, and compact status colors used only where they explain data.

## Colors

Ink frames navigation and important steps. Paper and pale green ground keep long planning sessions comfortable. Yellow calls attention to a next action or a leading choice. Green means available or going; amber means maybe or pending; soft red means unavailable or not going. Every state includes text as well as color.

## Typography

Thai copy uses the Noto Sans Thai stack. Large headings have a compact measure; body copy stays readable at 1rem with 1.7 line height. Counts and response totals use tabular numerals. Labels are short and literal.

## Layout

The main workspace is wider than the utility rail on desktop. On smaller screens, both become one column and the active work stays above management. Vote and RSVP tables scroll horizontally with a sticky name column. The journey strip remains a compact overview of the real trip stage.

## Elevation & Depth

Surfaces are defined primarily by a single border. A small, soft, offset shadow separates large panels from the ground. The landing preview gets a stronger shadow because it represents the working product against a dark shell.

## Shapes

Controls use 8px corners, content surfaces use 14px. Status tags use small rectangular corners; pills are reserved for small metadata. The brand mark is a two-stop route line rather than a decorative symbol.

## Components

Primary buttons are filled teal and name the action. Secondary buttons are outlined. Result rows use dividers within one surface, with count chips for each answer type. The response matrix shows a text status inside a colored tag. Empty, error, hover, focus, and disabled states must remain legible.

## Do's and Don'ts

- Do place the current plan or vote result before setup and administrative controls.
- Do show response counts, outstanding friends, and individual states together.
- Do use the same status wording in summaries and detail tables.
- Don't use a stack of identical cards where a list or table is clearer.
- Don't rely on color alone to explain attendance or availability.

# WePlanGo product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small groups of friends planning a trip together. Trip organizers and invited friends are equally important users.

## Product Purpose

Help a group agree on who is joining, when to travel, where to go, and who confirms the final plan. Success means both roles can complete the invite, vote, confirm, and RSVP flow without editing data outside the app.

## Operating Context

People open WePlanGo on phones and computers and share invitation links through their existing chats. Organizers create groups and trips, collect date and place answers, and confirm a plan. Invited friends respond to invitations, vote, and RSVP to the current plan.

## Capabilities and Constraints

- Google sign-in through Supabase Auth.
- Groups, membership roles, trip lifecycle, invitation links, date and place voting, confirmed plans, versioned RSVP, and in-app notifications.
- Current MVP uses Next.js, Supabase, and Vercel. Preserve the working flows and permission model during visual changes.
- Thai is the interface language. Trip times use each trip's selected time zone.
- The current release targets small groups and starts on free service tiers.

## Brand Commitments

Keep the WePlanGo name and a conversational, clear Thai interface. No supplied logo, photography, or other binding visual assets are recorded.

## Evidence on Hand

The current implementation and the MVP specification in `docs/` are the source of product behavior. The repository contains no supplied user testimonials or travel photography.

## Product Principles

1. Make the next action clear for both organizers and invited friends.
2. Show individual answers and the group's aggregate decision in one place.
3. Keep invitation interest separate from RSVP to the confirmed plan.
4. Make consequential actions and plan changes easy to understand before submission.

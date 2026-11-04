import type { ANIMATION_TYPES, BACKGROUND_TYPES, ICONS, TRANSITION_TYPES, VISUAL_ELEMENT_TYPES } from "./scene-plan";

/** Plain-language names for the scene plan vocabulary, used by the manual editor. */
export const ANIMATION_LABEL: Record<(typeof ANIMATION_TYPES)[number], string> = {
  fade_up: "Fade up",
  word_stagger: "Word by word",
  tracking_reveal: "Letters spread in",
  scale_pop: "Pop in",
  slide_in_left: "Slide from left",
  slide_in_right: "Slide from right",
  mask_wipe: "Wipe reveal",
  typewriter: "Typewriter",
  geometric_sweep: "Shape sweep",
  zoom_in: "Zoom in",
  none: "No animation",
};

export const TRANSITION_LABEL: Record<(typeof TRANSITION_TYPES)[number], string> = {
  cut: "Hard cut",
  crossfade: "Crossfade",
  wipe_left: "Wipe left",
  wipe_up: "Wipe up",
  shape_morph: "Shape morph",
  zoom_through: "Zoom through",
  whip_pan: "Whip pan",
  circle_reveal: "Circle reveal",
};

export const BACKGROUND_LABEL: Record<(typeof BACKGROUND_TYPES)[number], string> = {
  solid: "Solid",
  split: "Split",
  shape_field: "Shapes",
  grid: "Grid",
  brand_gradient_flat: "Two-tone",
};

export const ELEMENT_LABEL: Record<(typeof VISUAL_ELEMENT_TYPES)[number], string> = {
  kinetic_text: "Animated text",
  word_stagger: "Word-by-word text",
  tracking_reveal: "Spread-out text",
  geometric_sweep: "Shape sweep",
  shape_burst: "Shape burst",
  icon_animation: "Icon",
  screenshot_reveal: "Product window",
  product_recording: "Product recording",
  feature_callout: "Feature badge",
  stat_counter: "Big number",
  logo_reveal: "Logo",
  cta_end_card: "Call-to-action card",
  photo: "Photo",
  sparkles: "Sparkles",
  orbit: "Orbiting rings",
  marquee: "Scrolling text band",
  confetti: "Confetti",
};

export const PHOTO_MOTION_LABEL = { ken_burns: "Slow zoom & drift", zoom_out: "Zoom out", pan_left: "Pan left", pan_right: "Pan right", float: "Float" } as const;
export const PHOTO_STYLE_LABEL = { full: "Full screen", card: "Card", circle: "Circle", tilted: "Tilted print" } as const;
export const CAMERA_LABEL = { none: "Still", drift: "Gentle drift", push_in: "Slow zoom in", pull_out: "Zoom out", punch_in: "Punch in on the beat", pan: "Pan across" } as const;
export const GRAPHICS_LABEL = { calm: "Calm", lively: "Lively", bold: "Bold" } as const;

/** Elements whose own `text` is shown on screen (the headline and button text are edited separately). */
export const TEXT_ELEMENTS = new Set<(typeof VISUAL_ELEMENT_TYPES)[number]>(["feature_callout", "stat_counter"]);

/** Elements that show the scene's button (scene.cta). */
export const BUTTON_ELEMENTS = new Set<(typeof VISUAL_ELEMENT_TYPES)[number]>(["cta_end_card", "screenshot_reveal", "product_recording"]);

/** Elements people can add by hand, with sensible starting values. */
export const ADDABLE_ELEMENTS: { type: (typeof VISUAL_ELEMENT_TYPES)[number]; text?: string; icon?: (typeof ICONS)[number] }[] = [
  { type: "photo" },
  { type: "sparkles" },
  { type: "orbit" },
  { type: "marquee" },
  { type: "confetti" },
  { type: "feature_callout", text: "New feature", icon: "sparkle" },
  { type: "stat_counter", text: "3" },
  { type: "screenshot_reveal" },
  { type: "shape_burst" },
  { type: "logo_reveal" },
  { type: "cta_end_card", text: "Shop now" },
];

export const COLOR_ROLES = ["primary", "secondary", "accent", "ink", "paper"] as const;
export const COLOR_ROLE_LABEL: Record<(typeof COLOR_ROLES)[number], string> = {
  primary: "Main",
  secondary: "Second",
  accent: "Accent",
  ink: "Text",
  paper: "Background",
};

/** Headline fonts offered in the editor (all on Google Fonts, so previews and exports match). */
export const HEADING_FONTS = ["Archivo", "Inter", "Poppins", "Montserrat", "DM Sans", "Space Grotesk", "Bricolage Grotesque", "Playfair Display", "DM Serif Display", "Bebas Neue", "Sora", "Outfit"];

// SVG files are imported as React components via react-native-svg-transformer
// (see metro.config.js). The .svg files in assets/ are the editable source of truth.
export { default as ArrowRightIcon } from '@/assets/icons/arrow-right.svg';
export { default as SparkIcon } from '@/assets/icons/spark.svg';
export { default as LogoMark } from '@/assets/branding/logo-mark.svg';
export { default as EmptyStateIllustration } from '@/assets/illustrations/empty-state.svg';
export { default as FlashcardsIllustration } from '@/assets/illustrations/flashcards.svg';
export { default as OnboardingIllustration } from '@/assets/illustrations/onboarding.svg';
export { default as ProgressIllustration } from '@/assets/illustrations/progress.svg';
export { default as QuizIllustration } from '@/assets/illustrations/quiz.svg';

/** Width / height of every illustration in assets/illustrations (320x240 viewBox). */
export const ILLUSTRATION_ASPECT_RATIO = 4 / 3;

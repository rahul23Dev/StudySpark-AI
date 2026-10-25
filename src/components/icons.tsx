import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Line icons on a 24x24 grid. Decorative by default; label the control that holds them. */
export type IconProps = { color: ColorValue; size?: number };

const stroke = (color: ColorValue) => ({
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" {...stroke(color)} />
    </Svg>
  );
}

export function DecksIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Rect x={7} y={4} width={13} height={16} rx={2.5} {...stroke(color)} />
      <Path d="M4 7.5v10A2.5 2.5 0 0 0 6.5 20" {...stroke(color)} />
      <Path d="M10.5 9h6M10.5 12.5h4" {...stroke(color)} />
    </Svg>
  );
}

export function ProgressIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M5 20v-6M10 20V9M15 20v-4M20 20V5" {...stroke(color)} />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Circle cx={12} cy={8.5} r={3.5} {...stroke(color)} />
      <Path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...stroke(color)} />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Circle cx={12} cy={12} r={3} {...stroke(color)} />
      <Path
        d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"
        {...stroke(color)}
      />
    </Svg>
  );
}

export function SparkleIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M12 3q1 7 8 8q-7 1-8 8q-1-7-8-8q7-1 8-8Z" fill={color} />
    </Svg>
  );
}

export function ChevronRightIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="m9 6 6 6-6 6" {...stroke(color)} />
    </Svg>
  );
}

export function ArrowRightIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="M5 12h14M13 6l6 6-6 6" {...stroke(color)} strokeWidth={2.5} />
    </Svg>
  );
}

export function CheckIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d="m5 12.5 4.5 4.5L19 7.5" {...stroke(color)} strokeWidth={2.5} />
    </Svg>
  );
}

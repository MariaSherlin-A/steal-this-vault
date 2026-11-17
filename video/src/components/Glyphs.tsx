import React from "react";
import { C } from "../theme";

/** A padlock, drawn in line. `open` lifts the shackle. */
export const Padlock: React.FC<{ size?: number; color?: string; open?: number; glow?: boolean; style?: React.CSSProperties }> = ({
  size = 44,
  color = C.brass,
  open = 0,
  glow = false,
  style,
}) => (
  <svg
    width={size}
    height={size * 1.2}
    viewBox="0 0 40 48"
    style={{ filter: glow ? `drop-shadow(0 0 ${size * 0.35}px ${color})` : undefined, ...style }}
  >
    <path
      d={`M11 ${22 - open * 10} V14 a9 9 0 0 1 18 0 v${8 + open * 10}`}
      fill="none"
      stroke={color}
      strokeWidth={3.2}
      strokeLinecap="round"
      transform={open > 0 ? `translate(${open * 6} 0)` : undefined}
    />
    <rect x={5} y={22} width={30} height={22} rx={4} fill={C.bg2} stroke={color} strokeWidth={3.2} />
    <circle cx={20} cy={32} r={3} fill={color} />
    <rect x={18.6} y={33} width={2.8} height={6} rx={1} fill={color} />
  </svg>
);

/** A key, the classical one. */
export const Key: React.FC<{ size?: number; color?: string; style?: React.CSSProperties; glow?: boolean }> = ({
  size = 40,
  color = C.brass,
  style,
  glow = false,
}) => (
  <svg
    width={size * 2}
    height={size}
    viewBox="0 0 80 40"
    style={{ filter: glow ? `drop-shadow(0 0 ${size * 0.4}px ${color})` : undefined, ...style }}
  >
    <circle cx={16} cy={20} r={11} fill="none" stroke={color} strokeWidth={3.2} />
    <circle cx={16} cy={20} r={3.5} fill={color} />
    <path d="M27 20 H74 M60 20 v8 M68 20 v11" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" />
  </svg>
);

/** A coin. */
export const Coin: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 36, style }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={style}>
    <circle cx={20} cy={20} r={18} fill={C.brassDeep} stroke={C.brass} strokeWidth={2.5} />
    <circle cx={20} cy={20} r={12} fill="none" stroke={C.brass} strokeWidth={1.5} opacity={0.7} />
    <text x={20} y={25.5} textAnchor="middle" fontSize={15} fontFamily="Georgia, serif" fill={C.text}>
      Q
    </text>
  </svg>
);

// src/components/ui/primitives.tsx — Vanta Editorial primitives
"use client";
import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Parameters<typeof clsx>) { return twMerge(clsx(inputs)); }

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary"|"ghost"|"outline"; size?: "sm"|"md"|"lg"; loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement,ButtonProps>(
  ({ className,variant="primary",size="md",loading,disabled,children,...props },ref) => {
    const base="inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:pointer-events-none";
    const variants={
      primary:"bg-[var(--blue)] text-[var(--void)] hover:opacity-90 hover:-translate-y-px active:scale-[0.97]",
      ghost:"bg-transparent text-[rgba(245,241,234,0.50)] hover:text-[var(--pearl)] hover:bg-[rgba(255,255,255,0.05)] active:scale-[0.97]",
      outline:"bg-transparent border border-[rgba(255,255,255,0.10)] text-[rgba(245,241,234,0.55)] hover:border-[rgba(255,255,255,0.18)] hover:text-[var(--pearl)] active:scale-[0.97]",
    };
    const sizes={sm:"text-xs px-4 py-2 h-8",md:"text-sm px-5 py-2.5 h-10",lg:"text-base px-7 py-3 h-12"};
    return (
      <button ref={ref} className={cn(base,variants[variant],sizes[size],className)} disabled={disabled||loading} {...props}>
        {loading?<><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"/>{children}</>:children}
      </button>
    );
  }
);
Button.displayName="Button";

// Badge
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:"default"|"blue"|"amber"|"rose"|"green"|"muted";
}
export const Badge: React.FC<BadgeProps> = ({ className,variant="default",...props }) => {
  const v={
    default:"bg-[rgba(255,255,255,0.04)] text-[rgba(245,241,234,0.45)] border-[rgba(255,255,255,0.09)]",
    blue:   "bg-[rgba(107,138,253,0.08)] text-[var(--blue)] border-[rgba(107,138,253,0.25)]",
    amber:  "bg-[rgba(244,185,97,0.08)] text-[var(--amber)] border-[rgba(244,185,97,0.25)]",
    rose:   "bg-[rgba(248,113,113,0.08)] text-[var(--v-false)] border-[rgba(248,113,113,0.25)]",
    green:  "bg-[rgba(110,231,160,0.08)] text-[var(--v-true)] border-[rgba(110,231,160,0.25)]",
    muted:  "bg-[rgba(255,255,255,0.02)] text-[rgba(245,241,234,0.30)] border-[rgba(255,255,255,0.06)]",
  };
  return <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium tracking-wide",v[variant],className)} style={{fontFamily:"var(--font-mono),monospace",letterSpacing:"0.10em",textTransform:"uppercase"}} {...props}/>;
};

// Card
export const Card: React.FC<{padded?:boolean}&React.HTMLAttributes<HTMLDivElement>> = ({className,padded=true,...props}) => (
  <div className={cn("crystal",padded&&"p-5 sm:p-6",className)} {...props}/>
);

// Divider
export const Divider: React.FC<React.HTMLAttributes<HTMLHRElement>> = ({className,...props}) => (
  <hr className={cn("border-0 border-t border-[rgba(255,255,255,0.055)]",className)} {...props}/>
);

// Skeleton
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({className,...props}) => (
  <div className={cn("skeleton",className)} {...props}/>
);

// SectionLabel
export const SectionLabel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({className,children,...props}) => (
  <div className={cn("v-section-label",className)} {...props}>
    <span>{children}</span>
  </div>
);

// Tooltip
export const Tooltip: React.FC<{content:string;children:React.ReactNode}> = ({content,children}) => (
  <span className="relative group inline-flex">
    {children}
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50"
      style={{background:"rgba(28,28,28,0.95)",border:"1px solid rgba(255,255,255,0.10)",color:"var(--pearl-2)",fontFamily:"var(--font-sans),system-ui,sans-serif"}}>
      {content}
    </span>
  </span>
);

// src/components/ui/StarMark.tsx
export function StarMark() {
  return (
    <div className="star-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" role="presentation" aria-hidden="true">
        <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" />
      </svg>
    </div>
  );
}

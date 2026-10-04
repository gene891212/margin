import type { ReactNode } from "react";

/** White rounded card used for every settings section. */
export function SettingsCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-[#fffefc] border border-[#ded8cb] rounded-xl p-5 shadow-2xs ${className}`}>{children}</div>;
}

/** Bold title + muted description pair used at the top of setting rows. */
export function SettingLabel({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold text-[#1a1d18]">{title}</div>
      {description && <div className="text-[11px] text-[#73786e] mt-0.5">{description}</div>}
    </div>
  );
}

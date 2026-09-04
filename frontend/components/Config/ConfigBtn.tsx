import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface ConfigBtnProps {
  link: string;
  title: string;
  icon: LucideIcon;
  color: string;
  disabled?: boolean;
  badge?: string;
}

const ConfigBtn = ({ title, icon: Icon, color, link, disabled, badge }: ConfigBtnProps) => {
  const inner = (
    <div
      className={`bg-card p-6 rounded-xl border border-border shadow-sm flex items-center gap-4 transition-shadow duration-300 ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md hover:bg-muted cursor-pointer"
      }`}
    >
      <div className={`p-3 mr-2 rounded-xl ${color} flex items-center justify-center`}>
        <Icon size={28} strokeWidth={2} />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="text-lg font-semibold leading-none">{title}</span>
        {badge && (
          <span className="inline-flex w-fit text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 bg-amber-100 text-amber-800 border border-amber-200">
            {badge}
          </span>
        )}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div aria-disabled className="select-none">
        {inner}
      </div>
    );
  }

  return <Link href={link}>{inner}</Link>;
};

export default ConfigBtn;



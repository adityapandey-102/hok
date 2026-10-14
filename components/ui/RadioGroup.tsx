import { Icon, type IconName } from "./Icon";
export function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  disabled,
  column,
}: {
  name: string;
  value: T | "";
  onChange: (value: T) => void;
  /** `icon`: an optional Lucide icon shown before the label. */
  options: { value: T; label: string; icon?: IconName }[];
  disabled?: boolean;
  column?: boolean;
}) {
  return (
    <div className={`flex gap-2 ${column ? "flex-col" : "flex-wrap"}`}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-2 rounded-app-sm border px-3 py-2 text-sm transition-colors ${
              selected
                ? "border-primary bg-primary-bg font-medium text-primary"
                : "border-border bg-card text-text-secondary hover:border-primary-light"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="accent-[var(--color-primary)]"
            />
            {option.icon && <Icon name={option.icon} size={15} className={selected ? "text-primary" : "text-text-muted"} />}
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

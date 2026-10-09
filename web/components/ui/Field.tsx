// A labelled field. The rule under it is the field. Server-renderable; no state.
import type { ReactNode } from "react";

type Opt = { value: string; label: string };
type Props = {
  label: string;
  name: string;
  type?: "text" | "date" | "select" | "textarea";
  options?: Opt[];
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  hint?: ReactNode;
  disabled?: boolean;
};

export function Field({ label, name, type = "text", options, hint, ...rest }: Props) {
  const id = `f-${name}`;
  return (
    <div className="alt-field flex flex-col gap-1">
      <label htmlFor={id} className="alt-label">
        {label}
      </label>
      {type === "select" ? (
        <select id={id} name={name} className="no-ring" {...rest}>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea id={id} name={name} rows={2} className="no-ring" {...rest} />
      ) : (
        <input id={id} name={name} type={type} className="no-ring" {...rest} />
      )}
      {hint ? <p className="alt-meta">{hint}</p> : null}
    </div>
  );
}

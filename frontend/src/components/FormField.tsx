type FormFieldProps = {
  label: string;
  value: string;
  type?: "email" | "password" | "text";
  onChange: (value: string) => void;
};

export function FormField({ label, value, type = "text", onChange }: FormFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}


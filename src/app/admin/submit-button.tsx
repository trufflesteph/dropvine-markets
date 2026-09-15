"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  className: string;
};

export default function SubmitButton({ children, pendingLabel = "Saving...", className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return <button className={`${className} disabled:cursor-wait disabled:opacity-60`} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}
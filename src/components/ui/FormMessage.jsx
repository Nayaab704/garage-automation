const messageClassNames = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

function FormMessage({ children, tone = "error" }) {
  if (!children) {
    return null;
  }

  const toneClassName = messageClassNames[tone] ?? messageClassNames.error;

  return (
    <div className={`rounded-2xl border p-3 text-sm ${toneClassName}`}>
      {children}
    </div>
  );
}

export default FormMessage;

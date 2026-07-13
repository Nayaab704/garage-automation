import { buttonClassNames } from "./uiStyles";

const sizeClassNames = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

function ModalShell({
  children,
  description = "",
  eyebrow = "",
  isCloseDisabled = false,
  onClose,
  size = "md",
  title,
}) {
  const widthClassName = sizeClassNames[size] ?? sizeClassNames.md;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        className={`max-h-[92vh] w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${widthClassName}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow && (
              <p className="truncate text-xs font-black uppercase tracking-wide text-blue-700">
                {eyebrow}
              </p>
            )}
            <h3 className="text-lg font-black text-slate-950">{title}</h3>
            {description && (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>

          {onClose && (
            <button
              className={`shrink-0 px-3 py-2 ${buttonClassNames.secondary}`}
              disabled={isCloseDisabled}
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          )}
        </div>

        <div className="max-h-[calc(92vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
      </section>
    </div>
  );
}

export default ModalShell;

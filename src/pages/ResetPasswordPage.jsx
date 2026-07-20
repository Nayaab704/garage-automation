import { useEffect, useRef, useState } from "react";
import BrandLogo from "../components/branding/BrandLogo";
import AppBackground from "../components/ui/AppBackground";
import AppIcon from "../components/ui/AppIcon";
import {
  buttonClassNames,
  cardClassNames,
  formControlClassNames,
} from "../components/ui/uiStyles";
import { supabase } from "../lib/supabaseClient";

const emptyForm = {
  confirmPassword: "",
  newPassword: "",
};

function PasswordField({
  autoComplete = "new-password",
  id,
  isVisible,
  label,
  name,
  onChange,
  onToggleVisibility,
  value,
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className={formControlClassNames.label}>{label}</span>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className={`${formControlClassNames.input} pr-14`}
          id={id}
          minLength={8}
          name={name}
          onChange={onChange}
          required
          type={isVisible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
          onClick={onToggleVisibility}
          type="button"
        >
          <AppIcon name={isVisible ? "eye-off" : "eye"} size={20} />
        </button>
      </div>
    </label>
  );
}

function ResetPasswordPage({ onComplete }) {
  const [formData, setFormData] = useState(emptyForm);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const completionTimerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      setIsCheckingSession(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error) {
          setHasRecoverySession(false);
          setErrorMessage("This password reset link is invalid or expired.");
          return;
        }

        if (data.session) {
          setHasRecoverySession(true);
          setErrorMessage("");
          return;
        }

        setHasRecoverySession(false);
        setErrorMessage("This password reset link is invalid or expired.");
      } catch {
        if (isMounted) {
          setHasRecoverySession(false);
          setErrorMessage("This password reset link is invalid or expired.");
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || nextSession) {
        setHasRecoverySession(true);
        setErrorMessage("");
        setIsCheckingSession(false);
      }
    });

    checkRecoverySession();

    return () => {
      isMounted = false;
      window.clearTimeout(completionTimerRef.current);
      subscription.unsubscribe();
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function validateForm() {
    if (formData.newPassword.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!hasRecoverySession) {
      setErrorMessage("This password reset link is invalid or expired.");
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) {
        setErrorMessage(error.message || "Could not update password.");
        return;
      }

      setFormData(emptyForm);
      setSuccessMessage("Password updated successfully. Redirecting to sign in...");
      completionTimerRef.current = window.setTimeout(async () => {
        await supabase.auth.signOut();
        onComplete?.();
      }, 1600);
    } catch (error) {
      setErrorMessage(error.message ?? "Could not update password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppBackground>
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <section className={`w-full max-w-md p-6 ${cardClassNames.elevated}`}>
          <div className="mb-6">
            <BrandLogo showTagline size="large" />
            <h1 className="mt-2 text-2xl font-bold text-zinc-950">
              Set a new password
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Choose a new password for your Makkah Autosales account.
            </p>
          </div>

          {isCheckingSession ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Checking reset link...
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <PasswordField
                id="reset-new-password"
                isVisible={isNewPasswordVisible}
                label="New Password"
                name="newPassword"
                onChange={handleChange}
                onToggleVisibility={() =>
                  setIsNewPasswordVisible((currentValue) => !currentValue)
                }
                value={formData.newPassword}
              />

              <PasswordField
                id="reset-confirm-password"
                isVisible={isConfirmPasswordVisible}
                label="Confirm Password"
                name="confirmPassword"
                onChange={handleChange}
                onToggleVisibility={() =>
                  setIsConfirmPasswordVisible((currentValue) => !currentValue)
                }
                value={formData.confirmPassword}
              />

              {errorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {successMessage}
                </div>
              )}

              <button
                className={`w-full ${buttonClassNames.primary}`}
                disabled={isSubmitting || !hasRecoverySession}
                type="submit"
              >
                {isSubmitting ? "Updating..." : "Update Password"}
              </button>

              {!hasRecoverySession && (
                <button
                  className={`w-full ${buttonClassNames.secondary}`}
                  onClick={onComplete}
                  type="button"
                >
                  Back to Sign In
                </button>
              )}
            </form>
          )}
        </section>
      </main>
    </AppBackground>
  );
}

export default ResetPasswordPage;

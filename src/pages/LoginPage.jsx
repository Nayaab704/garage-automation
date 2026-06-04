import { useState } from "react";
import { APP_NAME } from "../config/appConfig";
import AppBackground from "../components/ui/AppBackground";
import {
  buttonClassNames,
  cardClassNames,
  formControlClassNames,
} from "../components/ui/uiStyles";
import { supabase } from "../lib/supabaseClient";

const emptyForm = {
  email: "",
  password: "",
};

function LoginPage() {
  const [formData, setFormData] = useState(emptyForm);
  const [loadingAction, setLoadingAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSignIn() {
    setLoadingAction("sign-in");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Signed in successfully.");
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setLoadingAction("");
    }
  }

  async function handleSignUp() {
    setLoadingAction("sign-up");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        setSuccessMessage("Account created. Signing you in...");
      } else {
        setSuccessMessage("Account created. Check your email to confirm it.");
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setLoadingAction("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await handleSignIn();
  }

  const isSubmitting = loadingAction !== "";

  return (
    <AppBackground>
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <section className={`w-full max-w-md p-6 ${cardClassNames.elevated}`}>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {APP_NAME}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-zinc-950">
              Sign in to continue
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Use your email and password to access the garage dashboard.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block" htmlFor="login-email">
              <span className={formControlClassNames.label}>Email</span>
              <input
                autoComplete="email"
                className={formControlClassNames.input}
                id="login-email"
                name="email"
                onChange={handleChange}
                required
                type="email"
                value={formData.email}
              />
            </label>

            <label className="block" htmlFor="login-password">
              <span className={formControlClassNames.label}>Password</span>
              <input
                autoComplete="current-password"
                className={formControlClassNames.input}
                id="login-password"
                name="password"
                onChange={handleChange}
                required
                type="password"
                value={formData.password}
              />
            </label>

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

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className={buttonClassNames.primary}
                disabled={isSubmitting}
                type="submit"
              >
                {loadingAction === "sign-in" ? "Signing In..." : "Sign In"}
              </button>

              <button
                className={buttonClassNames.secondary}
                disabled={isSubmitting}
                onClick={handleSignUp}
                type="button"
              >
                {loadingAction === "sign-up" ? "Signing Up..." : "Sign Up"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppBackground>
  );
}

export default LoginPage;

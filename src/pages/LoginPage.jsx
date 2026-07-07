import { useState } from "react";
import BrandLogo from "../components/branding/BrandLogo";
import AppBackground from "../components/ui/AppBackground";
import {
  buttonClassNames,
  cardClassNames,
  formControlClassNames,
} from "../components/ui/uiStyles";
import { supabase } from "../lib/supabaseClient";

const emptyForm = {
  email: "",
  fullName: "",
  password: "",
};

function LoginPage() {
  const [formData, setFormData] = useState(emptyForm);
  const [authMode, setAuthMode] = useState("sign-in");
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

  function handleModeChange(nextMode) {
    setAuthMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
    setLoadingAction("");
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
    const fullName = formData.fullName.trim();

    if (!fullName) {
      setErrorMessage("Full name is required to create an account.");
      return;
    }

    setLoadingAction("sign-up");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
          },
        },
        password: formData.password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const profileSaved = await saveSignupProfileName(
        data.user,
        fullName,
        formData.email
      );
      const profileNotice = profileSaved
        ? ""
        : " Your account was created, but the profile name could not be saved yet.";

      if (data.session) {
        setSuccessMessage(`Account created. Signing you in...${profileNotice}`);
      } else {
        setSuccessMessage(
          `Account created. Check your email to confirm it.${profileNotice}`
        );
      }
    } catch (error) {
      setErrorMessage(error.message ?? "Something went wrong.");
    } finally {
      setLoadingAction("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (authMode === "sign-up") {
      await handleSignUp();
      return;
    }

    await handleSignIn();
  }

  const isSubmitting = loadingAction !== "";
  const isSignUp = authMode === "sign-up";

  return (
    <AppBackground>
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <section className={`w-full max-w-md p-6 ${cardClassNames.elevated}`}>
          <div className="mb-6">
            <BrandLogo showTagline size="large" />
            <h1 className="mt-2 text-2xl font-bold text-zinc-950">
              {isSignUp ? "Create your account" : "Sign in to continue"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {isSignUp
                ? "Add your name so the workspace can greet and identify you clearly."
                : "Use your email and password to access the garage dashboard."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isSignUp && (
              <label className="block" htmlFor="signup-full-name">
                <span className={formControlClassNames.label}>Full Name</span>
                <input
                  autoComplete="name"
                  className={formControlClassNames.input}
                  id="signup-full-name"
                  name="fullName"
                  onChange={handleChange}
                  required
                  type="text"
                  value={formData.fullName}
                />
              </label>
            )}

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
                {loadingAction === "sign-in"
                  ? "Signing In..."
                  : loadingAction === "sign-up"
                    ? "Signing Up..."
                    : isSignUp
                      ? "Sign Up"
                      : "Sign In"}
              </button>

              <button
                className={buttonClassNames.secondary}
                disabled={isSubmitting}
                onClick={() =>
                  handleModeChange(isSignUp ? "sign-in" : "sign-up")
                }
                type="button"
              >
                {isSignUp ? "Back to Sign In" : "Create Account"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </AppBackground>
  );
}

async function saveSignupProfileName(user, fullName, email) {
  if (!user?.id) {
    return true;
  }

  try {
    const profilePayload = {
      auth_user_id: user.id,
      email: email.trim(),
      full_name: fullName,
      is_active: false,
      role: "technician",
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "auth_user_id" });

    if (!error) {
      return true;
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        email: profilePayload.email,
        full_name: fullName,
        is_active: false,
        role: "technician",
      })
      .eq("auth_user_id", user.id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Could not save signup profile name:", updateError);
      return false;
    }

    return Boolean(updatedProfile);
  } catch (error) {
    console.error("Could not save signup profile name:", error);
    return false;
  }
}

export default LoginPage;

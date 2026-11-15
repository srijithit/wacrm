"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Sparkles,
  Bot,
  Zap,
  Layers,
  ShieldCheck,
} from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const linkError = searchParams.get("error");
  const linkErrorMessage =
    linkError === "link_expired"
      ? t("linkExpired")
      : linkError === "link_invalid"
        ? t("linkInvalid")
        : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    window.location.href = destination;
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background lg:flex-row">
      {/* Left Column: Premium SaaS Hero & Feature Showcase */}
      <div className="relative hidden w-full flex-col justify-between overflow-hidden border-r border-purple-500/10 bg-gradient-to-br from-[#0c0414] via-[#15062b] to-[#260e42] p-8 text-white lg:flex lg:w-1/2 xl:w-[50%] xl:p-12 2xl:p-16">
        {/* Ambient Gradient Glows */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[140px]" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-[100px]" />

        {/* Subtle grid background texture */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:36px_36px]" />

        {/* Top Header: Brand & Identity */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-purple-500/30 bg-[#080214] p-1.5 shadow-lg shadow-purple-950/50 ring-1 ring-white/10">
            <Image
              src="/logo-mark.png"
              alt="Royaal CRM"
              width={40}
              height={40}
              className="size-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white">
              Royaal CRM
            </span>
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-purple-300/80">
              AI WHATSAPP MARKETING &amp; COMMERCIAL AUTOMATION
            </span>
          </div>
        </div>

        {/* Center Section: Hero Copy & Feature Cards */}
        <div className="relative z-10 my-auto py-8">
          {/* Pill Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/15 px-3.5 py-1.5 text-xs font-medium text-purple-200 shadow-sm backdrop-blur-md">
            <Sparkles className="size-3.5 text-purple-300" />
            <span>{t("platformBadge")}</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-5xl">
            {t("heroTitle1")}{" "}
            <span className="block bg-gradient-to-r from-purple-300 via-pink-300 to-indigo-300 bg-clip-text text-transparent">
              {t("heroTitle2")}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-purple-200/70 xl:text-base">
            {t("heroSubtitle")}
          </p>

          {/* Feature Highlights Grid */}
          <div className="mt-8 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Card 1: 24/7 AI Concierge */}
              <div className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all hover:border-purple-500/30 hover:bg-white/[0.07]">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                    <Bot className="size-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-white xl:text-sm">
                    {t("featureAiTitle")}
                  </h3>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-purple-200/60 xl:text-xs">
                  {t("featureAiDesc")}
                </p>
              </div>

              {/* Card 2: 1-Click Meta Signup */}
              <div className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all hover:border-purple-500/30 hover:bg-white/[0.07]">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                    <Zap className="size-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-white xl:text-sm">
                    {t("featureMetaTitle")}
                  </h3>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-purple-200/60 xl:text-xs">
                  {t("featureMetaDesc")}
                </p>
              </div>
            </div>

            {/* Card 3: Enterprise WhatsApp Cloud API Suite */}
            <div className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all hover:border-purple-500/30 hover:bg-white/[0.07]">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                  <Layers className="size-4" />
                </div>
                <h3 className="text-xs font-semibold text-white xl:text-sm">
                  {t("featureSuiteTitle")}
                </h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-purple-200/60 xl:text-xs">
                {t("featureSuiteDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Footer: Trust & Version */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs">
          <div className="flex items-center gap-2 font-medium text-purple-300/70">
            <ShieldCheck className="size-4 text-purple-400" />
            <span>{t("certified")}</span>
          </div>
          <div className="font-mono text-purple-400/50">
            {t("version")}
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="flex w-full min-h-screen flex-1 items-center justify-center bg-background px-6 py-12 sm:px-10 lg:w-1/2 lg:px-12 xl:w-[50%] xl:px-16">
        <div className="w-full max-w-md space-y-7">
          {/* Mobile-Only Logo Header */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-purple-500/30 bg-[#080214] p-1.5 shadow-md shadow-purple-950/30">
              <Image
                src="/logo-mark.png"
                alt="Royaal CRM"
                width={40}
                height={40}
                className="size-full object-contain"
                priority
              />
            </div>
            <div>
              <span className="text-lg font-bold text-foreground">
                Royaal CRM
              </span>
              <p className="font-mono text-[9px] font-semibold uppercase text-muted-foreground">
                Commercial WhatsApp CRM
              </p>
            </div>
          </div>

          {/* Form Header */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {inviteToken ? t("titleAccept") : t("signInTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {inviteToken ? t("descAccept") : t("signInSubtitle")}
            </p>
          </div>

          {/* Alerts */}
          {linkErrorMessage && !error && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300">
              {linkErrorMessage}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email or Username Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground/90">
                {t("emailOrUsernameLabel")}
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  placeholder={t("emailOrUsernamePlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-11 rounded-xl border-border bg-muted/30 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600/30"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide & Forgot Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">
                  {t("passwordLabel")}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-purple-600 transition-colors hover:text-purple-500 dark:text-purple-400"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-border bg-muted/30 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(val) => setRememberMe(Boolean(val))}
                className="rounded border-border data-[checked]:border-purple-600 data-[checked]:bg-purple-600"
              />
              <label
                htmlFor="remember-me"
                className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("rememberMe")}
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 font-semibold text-white shadow-md shadow-purple-600/25 transition-all hover:from-purple-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-purple-600/35 disabled:opacity-50 sm:h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t("signingIn")}</span>
                </>
              ) : (
                <>
                  <span>{inviteToken ? t("signIn") : t("signInToDashboard")}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* Administrator / Onboarding Help Notice */}
          <div className="space-y-4 pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              {t("contactAdmin")}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              {t("protectedBy")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

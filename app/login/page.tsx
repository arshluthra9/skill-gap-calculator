"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Frame } from "@/components/Frame";

export default function Login() {
  const router = useRouter();

  const [signup, setSignup] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!supabase) {
      setMsg("Supabase is not configured.");
      return;
    }

    setLoading(true);

    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              roll_number: rollNumber.trim().toUpperCase(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMsg("Account created! Please log in using your roll number and password.");
          setSignup(false);
        }
      } else {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rollNumber: rollNumber.trim().toUpperCase(),
            password,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Login failed.");
        }

        const { error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });

        if (error) throw error;

        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Frame>
      <div
        className="card"
        style={{ maxWidth: 480, margin: "30px auto" }}
      >
        <div className="eyebrow">
          CGC University • Student Access
        </div>

        <h1>{signup ? "Create your account" : "Welcome back"}</h1>

        <p className="muted">
          {signup
            ? "Register using your approved CGC roll number."
            : "Log in using your college roll number."}
        </p>

        <form onSubmit={submit}>
          {signup && (
            <>
              <label className="label">
                Full name
                <input
                  className="field"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </label>

              <label className="label">
                Email address
                <input
                  className="field"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Personal or college email"
                />
              </label>
            </>
          )}

          <label className="label">
            Roll number
            <input
              className="field"
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="Enter your CGC roll number"
            />
          </label>

          <label className="label">
            Password
            <input
              className="field"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </label>

          <button
            className="btn"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 18 }}
          >
            {loading
              ? "Please wait..."
              : signup
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        {msg && <p className="muted">{msg}</p>}

        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            setSignup(!signup);
            setMsg("");
          }}
        >
          {signup
            ? "Already registered? Log in"
            : "New student? Create an account"}
        </button>
      </div>
    </Frame>
  );
}

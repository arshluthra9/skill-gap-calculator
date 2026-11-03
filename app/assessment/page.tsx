"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Stage = {
  title: string;
  fields?: [string, string][];
  skills?: string[];
};

const stages: Stage[] = [
  {
    title: "Academic profile",
    fields: [
      ["degree", "Degree (BBA, BCom, BCA, MBA, other)"],
      ["year", "Current year / semester"],
      ["specialisation", "Specialisation"],
    ],
  },
  {
    title: "Career interests",
    fields: [
      ["interests", "Industries or roles you're curious about"],
      ["goal", "Your short-term career goal"],
    ],
  },
  {
    title: "Technical skills",
    skills: ["Excel", "SQL", "Python", "Financial accounting", "PowerPoint", "Data visualisation"],
  },
  {
    title: "People skills",
    skills: ["Communication", "Teamwork", "Problem solving", "Leadership", "Time management"],
  },
  {
    title: "Practical experience",
    fields: [
      ["experience", "Internships, projects, volunteering or work experience (write None if not applicable)"],
      ["certificates", "Certificates and training (write None if not applicable)"],
    ],
  },
  {
    title: "Review & goals",
    fields: [
      ["hours", "Hours available for learning each week"],
      ["notes", "Anything else we should consider (optional)"],
    ],
  },
];

const requiredFields = [
  ["degree", "year", "specialisation"],
  ["interests", "goal"],
  [],
  [],
  ["experience", "certificates"],
  ["hours"],
];

export default function Assessment() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const stage = stages[step];

  function setAnswer(key: string, value: string) {
    setAnswers((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: "" }));
    setMsg("");
  }

  function validateStage() {
    const newErrors: Record<string, string> = {};

    (requiredFields[step] || []).forEach((key) => {
      if (!answers[key]?.trim()) {
        newErrors[key] = "This field is required.";
      }
    });

    (stage.skills || []).forEach((skill) => {
      if (ratings[skill] === undefined) {
        newErrors[`rating:${skill}`] = "Please select a rating.";
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length) {
      setMsg("Please complete all required fields.");
      return false;
    }

    return true;
  }

  async function saveAssessment(
    nextStep: number,
    status: "in_progress" | "completed"
  ) {
    if (!supabase) {
      localStorage.setItem(
        "sgc-assessment",
        JSON.stringify({ answers, ratings, step: nextStep })
      );
      return true;
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMsg("Please log in before saving your assessment.");
      return false;
    }

    const payload = {
      student_id: authData.user.id,
      status,
      current_stage: nextStep,
      answers: { ...answers, ratings },
    };

    const { data: existing, error: lookupError } = await supabase
      .from("assessments")
      .select("id")
      .eq("student_id", authData.user.id)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      setMsg("Unable to check your saved assessment: " + lookupError.message);
      return false;
    }

    const result = existing?.id
      ? await supabase
          .from("assessments")
          .update(payload)
          .eq("id", existing.id)
          .eq("student_id", authData.user.id)
      : await supabase.from("assessments").insert(payload);

    if (result.error) {
      setMsg("Unable to save: " + result.error.message);
      return false;
    }

    return true;
  }

  async function saveProgress() {
    setLoading(true);
    setMsg("");

    try {
      const saved = await saveAssessment(step + 1, "in_progress");
      if (saved) setMsg("Progress saved successfully!");
    } catch {
      setMsg("Something went wrong while saving.");
    } finally {
      setLoading(false);
    }
  }

  async function nextStage() {
    if (!validateStage()) return;

    setLoading(true);
    setMsg("");

    try {
      const next = step + 1;
      const saved = await saveAssessment(next, "in_progress");

      if (saved) {
        setStep(next);
        setErrors({});
        setMsg("");
      }
    } catch {
      setMsg("Unable to save your progress. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function finishAssessment() {
    if (!validateStage()) return;

    setLoading(true);
    setMsg("");

    try {
      const saved = await saveAssessment(6, "completed");

      if (saved) {
        router.push("/results");
        router.refresh();
      }
    } catch {
      setMsg("Unable to submit your assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function previousStage() {
    setStep((old) => Math.max(0, old - 1));
    setErrors({});
    setMsg("");
  }

  return (
    <Frame>
      <div className="eyebrow">
        Student assessment · Stage {step + 1} of 6
      </div>

      <h1>{stage.title}</h1>

      <div className="progress" style={{ margin: "20px 0 28px" }}>
        <div style={{ width: ((step + 1) / 6 * 100) + "%" }} />
      </div>

      <div className="card">
        {stage.fields?.map(([key, label]) => (
          <label
            className="label"
            key={key}
            style={{ display: "block", marginBottom: 18 }}
          >
            {label}
            {requiredFields[step].includes(key) && (
              <span style={{ color: "#ef4444" }}> *</span>
            )}

            <textarea
              className="field"
              rows={3}
              value={answers[key] ?? ""}
              aria-invalid={!!errors[key]}
              onChange={(e) => setAnswer(key, e.target.value)}
              style={{
                borderColor: errors[key] ? "#ef4444" : undefined,
              }}
            />

            {errors[key] && (
              <small style={{ color: "#ef4444" }}>{errors[key]}</small>
            )}
          </label>
        ))}

        {stage.skills?.map((skill) => (
          <div key={skill} style={{ margin: "18px 0" }}>
            <div style={{ marginBottom: 8 }}>
              {skill} <span className="muted">· rating 0–5 *</span>
            </div>

            <select
              className="field"
              value={ratings[skill] ?? ""}
              aria-invalid={!!errors[`rating:${skill}`]}
              onChange={(e) => {
                setRatings((old) => ({
                  ...old,
                  [skill]: Number(e.target.value),
                }));
                setErrors((old) => ({
                  ...old,
                  [`rating:${skill}`]: "",
                }));
                setMsg("");
              }}
              style={{
                borderColor: errors[`rating:${skill}`]
                  ? "#ef4444"
                  : undefined,
              }}
            >
              <option value="">Choose rating</option>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} — {
                    [
                      "No experience",
                      "Beginner",
                      "Basic",
                      "Intermediate",
                      "Advanced",
                      "Strong / can teach",
                    ][n]
                  }
                </option>
              ))}
            </select>

            {errors[`rating:${skill}`] && (
              <small style={{ color: "#ef4444" }}>
                {errors[`rating:${skill}`]}
              </small>
            )}
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 24,
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn secondary"
            disabled={step === 0 || loading}
            onClick={previousStage}
          >
            Back
          </button>

          <button
            className="btn secondary"
            disabled={loading}
            onClick={saveProgress}
          >
            Save progress
          </button>

          {step < 5 ? (
            <button
              className="btn"
              disabled={loading}
              onClick={nextStage}
            >
              {loading ? "Saving..." : "Continue →"}
            </button>
          ) : (
            <button
              className="btn"
              disabled={loading}
              onClick={finishAssessment}
            >
              {loading ? "Submitting..." : "Submit assessment →"}
            </button>
          )}
        </div>

        {msg && (
          <p role="status" style={{ marginTop: 16 }}>
            {msg}
          </p>
        )}
      </div>
    </Frame>
  );
}

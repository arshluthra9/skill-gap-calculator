"use client";

import { useState } from "react";
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
    skills: [
      "Excel", "SQL", "Python", "Financial accounting",
      "PowerPoint", "Data visualisation",
    ],
  },
  {
    title: "People skills",
    skills: [
      "Communication", "Teamwork", "Problem solving",
      "Leadership", "Time management",
    ],
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stage = stages[step];

  function setAnswer(k: string, v: string) {
    setAnswers((a) => ({ ...a, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
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

    if (Object.keys(newErrors).length > 0) {
      setMsg("Please complete all required fields before continuing.");
      return false;
    }

    setMsg("");
    return true;
  }

  async function save() {
    try {
      if (!supabase) {
        localStorage.setItem(
          "sgc-assessment",
          JSON.stringify({ answers, ratings, step })
        );
        setMsg("Progress saved in this browser.");
        return;
      }

      const { data, error: authError } = await supabase.auth.getUser();

      if (authError || !data.user) {
        setMsg("Please log in before saving to your account.");
        return;
      }

      const { error } = await supabase
        .from("assessments")
        .upsert({
          student_id: data.user.id,
          status: "in_progress",
          current_stage: step + 1,
          answers: { ...answers, ratings },
        });

      setMsg(
        error
          ? `Unable to save: ${error.message}`
          : "Progress saved to your account."
      );
    } catch {
      setMsg("Something went wrong while saving. Please try again.");
    }
  }

  function nextStage() {
    if (!validateStage()) return;
    setStep((s) => s + 1);
  }

  function previousStage() {
    setStep((s) => Math.max(0, s - 1));
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
              <small style={{ color: "#ef4444" }}>
                {errors[key]}
              </small>
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
                setRatings((r) => ({
                  ...r,
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
            disabled={step === 0}
            onClick={previousStage}
          >
            Back
          </button>

          <button className="btn secondary" onClick={save}>
            Save progress
          </button>

          {step < 5 ? (
            <button className="btn" onClick={nextStage}>
              Continue →
            </button>
          ) : (
            <a
              className="btn"
              href="/results"
              onClick={(e) => {
                if (!validateStage()) e.preventDefault();
              }}
            >
              View preview results →
            </a>
          )}
        </div>

        {msg && (
          <p
            role="status"
            style={{
              color: errors && Object.values(errors).some(Boolean)
                ? "#ef4444"
                : undefined,
              marginTop: 16,
            }}
          >
            {msg}
          </p>
        )}
      </div>
    </Frame>
  );
}

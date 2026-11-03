"use client";

import { useEffect, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Career = {
  id: string;
  title: string;
  description: string | null;
  suitable_degrees: string[] | null;
};

type Requirement = {
  career_id: string;
  skill_id: string;
  required_level: number;
  weight: number;
};

type Skill = {
  id: string;
  name: string;
};

type Match = {
  career: Career;
  score: number;
  gaps: string[];
};

export default function Results() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [strong, setStrong] = useState<string[]>([]);
  const [improving, setImproving] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResults() {
      try {
        if (!supabase) {
          throw new Error("Database connection is not configured.");
        }

        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error("Please log in to view your results.");
        }

        const { data: assessments, error: assessmentError } =
          await supabase
            .from("assessments")
            .select("answers, status, updated_at")
            .eq("student_id", auth.user.id)
            .eq("status", "completed")
            .order("updated_at", { ascending: false })
            .limit(1);

        if (assessmentError) throw assessmentError;

        if (!assessments || assessments.length === 0) {
          throw new Error("No completed assessment found. Please complete your assessment first.");
        }

        const answers = assessments[0].answers || {};
        const ratings = answers.ratings || {};

        if (Object.keys(ratings).length === 0) {
          throw new Error("No skill ratings were found. Please complete the skill-rating stages.");
        }

        const [
          { data: careers, error: careerError },
          { data: requirements, error: requirementError },
          { data: skills, error: skillError },
        ] = await Promise.all([
          supabase.from("career_roles").select("id, title, description, suitable_degrees"),
          supabase.from("career_skill_requirements").select("career_id, skill_id, required_level, weight"),
          supabase.from("skills").select("id, name"),
        ]);

        if (careerError) throw careerError;
        if (requirementError) throw requirementError;
        if (skillError) throw skillError;

        const skillNames = new Map(
          (skills || []).map((skill: Skill) => [skill.id, skill.name])
        );

        const calculated: Match[] = (careers || []).map((career: Career) => {
          const careerRequirements = (requirements || []).filter(
            (item: Requirement) => item.career_id === career.id
          );

          let earned = 0;
          let totalWeight = 0;
          const gaps: string[] = [];

          careerRequirements.forEach((item: Requirement) => {
            const name = skillNames.get(item.skill_id);
            if (!name) return;

            const rating = Math.max(
              0,
              Math.min(5, Number(ratings[name] ?? 0))
            );

            const required = Math.max(
              1,
              Math.min(5, Number(item.required_level))
            );

            const weight = Math.max(0, Number(item.weight) || 0);

            earned += weight * Math.min(rating / required, 1);
            totalWeight += weight;

            if (rating < required) {
              gaps.push(name);
            }
          });

          return {
            career,
            score: totalWeight
              ? Math.round((earned / totalWeight) * 100)
              : 0,
            gaps,
          };
        });

        calculated.sort((a, b) => b.score - a.score);
        setMatches(calculated);

        const allRatings = Object.entries(ratings) as [string, number][];

        setStrong(
          allRatings
            .filter(([, rating]) => Number(rating) >= 4)
            .map(([name]) => name)
        );

        setImproving(
          allRatings
            .filter(([, rating]) => Number(rating) < 4)
            .map(([name]) => name)
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to calculate results."
        );
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, []);

  return (
    <Frame>
      <div className="eyebrow">Your personalised assessment</div>
      <h1>Your next step, made clearer.</h1>

      {loading && <p className="muted">Calculating your career matches...</p>}

      {error && (
        <div className="card">
          <h3>Unable to show your results</h3>
          <p className="muted">{error}</p>
        </div>
      )}

      {!loading && !error && matches.length > 0 && (
        <>
          <div className="card" style={{ marginTop: 24 }}>
            <span className="pill">Your top career match</span>

            <div className="stat" style={{ fontSize: 48, marginTop: 12 }}>
              {matches[0].score}%
            </div>

            <h2>{matches[0].career.title}</h2>

            <p className="muted">
              {matches[0].career.description ||
                "A career option based on your current skill ratings."}
            </p>

            <p className="muted">
              This is an indicative skill-match score, not a guarantee of
              career suitability or employment.
            </p>
          </div>

          <h2 style={{ marginTop: 32 }}>Your career matches</h2>

          {matches.map((match, index) => (
            <div className="card" key={match.career.id} style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <h3>
                  {index + 1}. {match.career.title}
                </h3>
                <strong>{match.score}%</strong>
              </div>

              <div className="progress" style={{ margin: "12px 0" }}>
                <div style={{ width: `${match.score}%` }} />
              </div>

              {match.gaps.length > 0 ? (
                <p className="muted">
                  Skills to improve: {match.gaps.join(", ")}
                </p>
              ) : (
                <p className="muted">You meet all listed skill requirements.</p>
              )}
            </div>
          ))}

          <h2 style={{ marginTop: 32 }}>Your skill profile</h2>

          <div className="card" style={{ marginTop: 14 }}>
            <h3>Strong skills · 4/5 or above</h3>
            {strong.length > 0 ? (
              <p className="muted">{strong.join(", ")}</p>
            ) : (
              <p className="muted">No strong skills identified yet.</p>
            )}

            <h3 style={{ marginTop: 24 }}>Skills to improve</h3>
            {improving.length > 0 ? (
              <p className="muted">{improving.join(", ")}</p>
            ) : (
              <p className="muted">Great work! No skills in this category.</p>
            )}
          </div>

          <p className="muted" style={{ marginTop: 20 }}>
            Scores are calculated from your self-reported ratings and the
            configured career skill requirements. They are indicative,
            not scientifically validated aptitude scores.
          </p>
        </>
      )}
    </Frame>
  );
}

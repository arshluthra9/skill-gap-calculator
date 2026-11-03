"use client";

import { useEffect, useMemo, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Career = {
  id: string;
  title: string;
  description: string;
  suitable_degrees: string[];
};

type Requirement = {
  career_id: string;
  required_level: number;
  weight: number;
  skills: { name: string } | null;
};

type CareerResult = {
  id: string;
  title: string;
  description: string;
  degrees: string[];
  match: number | null;
  requirements: {
    name: string;
    required: number;
    current: number;
  }[];
  gaps: string[];
};

export default function Careers() {
  const [careers, setCareers] = useState<CareerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [degree, setDegree] = useState("All degrees");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hasAssessment, setHasAssessment] = useState(false);

  useEffect(() => {
    loadCareers();
  }, []);

  async function loadCareers() {
    setLoading(true);
    setMessage("");

    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      let ratings: Record<string, number> = {};

      if (userData.user) {
        const { data: assessment, error: assessmentError } =
          await supabase
            .from("assessments")
            .select("answers")
            .eq("student_id", userData.user.id)
            .eq("status", "completed")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (assessmentError) throw assessmentError;

        if (assessment) {
          ratings =
            (assessment.answers as any)?.ratings || {};
          setHasAssessment(true);
        }
      }

      const [
        careerResult,
        requirementResult,
      ] = await Promise.all([
        supabase
          .from("career_roles")
          .select("id, title, description, suitable_degrees")
          .order("title"),

        supabase
          .from("career_skill_requirements")
          .select("career_id, required_level, weight, skills(name)"),
      ]);

      if (careerResult.error) throw careerResult.error;
      if (requirementResult.error) throw requirementResult.error;

      const requirements =
        requirementResult.data as unknown as Requirement[];

      const results: CareerResult[] = (
        careerResult.data as Career[]
      ).map((career) => {
        const careerRequirements = requirements.filter(
          (item) => item.career_id === career.id
        );

        let earned = 0;
        let total = 0;

        const skillRequirements = careerRequirements
          .filter((item) => item.skills?.name)
          .map((item) => {
            const name = item.skills!.name;
            const required = Number(item.required_level || 1);
            const current = Number(ratings[name] || 0);
            const weight = Math.max(Number(item.weight || 1), 0);

            earned +=
              Math.min(current / Math.max(required, 1), 1) *
              weight;

            total += weight;

            return {
              name,
              required,
              current,
            };
          });

        const gaps = skillRequirements
          .filter((skill) => skill.current < skill.required)
          .map((skill) => skill.name);

        return {
          id: career.id,
          title: career.title,
          description: career.description || "Explore the skills and responsibilities associated with this role.",
          degrees: career.suitable_degrees || [],
          match: hasAssessment || Object.keys(ratings).length
            ? total
              ? Math.round((earned / total) * 100)
              : 0
            : null,
          requirements: skillRequirements,
          gaps,
        };
      });

      setCareers(results);
    } catch (error: unknown) {
      console.error("Career explorer error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load career information."
      );
    }

    setLoading(false);
  }

  const degrees = useMemo(
    () => [
      "All degrees",
      ...Array.from(
        new Set(careers.flatMap((career) => career.degrees))
      ).sort(),
    ],
    [careers]
  );

  const filteredCareers = careers.filter((career) => {
    const matchesSearch =
      career.title.toLowerCase().includes(search.toLowerCase()) ||
      career.description.toLowerCase().includes(search.toLowerCase()) ||
      career.requirements.some((skill) =>
        skill.name.toLowerCase().includes(search.toLowerCase())
      );

    const matchesDegree =
      degree === "All degrees" ||
      career.degrees.some(
        (item) => item.toLowerCase() === degree.toLowerCase()
      );

    return matchesSearch && matchesDegree;
  });

  return (
    <Frame>
      <div className="eyebrow">CAREER EXPLORER</div>

      <h1>Find a career that matches your skills.</h1>

      <p className="muted">
        Explore career paths, understand their skill requirements
        and discover what you need to improve.
      </p>

      {!loading && (
        <div
          className="grid"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            marginTop: 24,
          }}
        >
          <div className="card">
            <div className="muted">Career paths available</div>
            <div className="stat">{careers.length}</div>
          </div>

          <div className="card">
            <div className="muted">Assessment connected</div>
            <div className="stat">
              {hasAssessment ? "Yes" : "No"}
            </div>
          </div>
        </div>
      )}

      <div
        className="grid"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: 24,
        }}
      >
        <input
          type="search"
          placeholder="Search careers or skills..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{
            width: "100%",
            padding: 13,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "transparent",
            color: "inherit",
          }}
        />

        <select
          value={degree}
          onChange={(event) => setDegree(event.target.value)}
          style={{
            width: "100%",
            padding: 13,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--background)",
            color: "inherit",
          }}
        >
          {degrees.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card" style={{ marginTop: 24 }}>
          Loading career opportunities...
        </div>
      ) : (
        <>
          {message && (
            <div className="card" style={{ marginTop: 24 }}>
              {message}
            </div>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(270px, 1fr))",
              marginTop: 24,
            }}
          >
            {filteredCareers.map((career) => (
              <div className="card" key={career.id}>
                <div className="eyebrow">CAREER PATH</div>

                <h2>{career.title}</h2>

                <p className="muted">
                  {career.description}
                </p>

                {career.match !== null ? (
                  <>
                    <div className="stat">
                      {career.match}%
                    </div>
                    <p className="muted">
                      Indicative skill match
                    </p>
                  </>
                ) : (
                  <p className="muted">
                    Complete your assessment to calculate
                    your skill match.
                  </p>
                )}

                <div className="eyebrow" style={{ marginTop: 18 }}>
                  SUITABLE DEGREES
                </div>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                  marginTop: 8,
                }}>
                  {career.degrees.map((item) => (
                    <span className="pill" key={item}>
                      {item}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                    className="button"
                    onClick={() =>
                      setExpanded(
                        expanded === career.id ? null : career.id
                      )
                    }
                  >
                    {expanded === career.id
                      ? "Hide skill map"
                      : "View skill map"}
                  </button>
                </div>

                {expanded === career.id && (
                  <div style={{ marginTop: 20 }}>
                    <div className="eyebrow">
                      REQUIRED SKILLS
                    </div>

                    {career.requirements.map((skill) => (
                      <div
                        key={skill.name}
                        style={{ marginTop: 14 }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                        }}>
                          <strong>{skill.name}</strong>
                          <small>
                            {skill.current}/5 · Need {skill.required}/5
                          </small>
                        </div>

                        <div style={{
                          height: 7,
                          background: "var(--line)",
                          borderRadius: 20,
                          overflow: "hidden",
                          marginTop: 7,
                        }}>
                          <div style={{
                            width: `${Math.min(skill.current, 5) * 20}%`,
                            height: "100%",
                            background: "var(--accent)",
                          }} />
                        </div>
                      </div>
                    ))}

                    <div className="eyebrow" style={{ marginTop: 22 }}>
                      SKILLS TO IMPROVE
                    </div>

                    {career.match === null ? (
                      <p className="muted">
                        Complete your assessment to identify
                        your skill gaps.
                      </p>
                    ) : career.gaps.length ? (
                      <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginTop: 10,
                      }}>
                        {career.gaps.map((skill) => (
                          <span className="pill" key={skill}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        No gaps in the currently mapped skills.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredCareers.length === 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              No careers match your search. Try another keyword
              or select a different degree.
            </div>
          )}
        </>
      )}

      <p className="muted" style={{ marginTop: 24 }}>
        Career matches are indicative comparisons against the
        skill requirements in our database. They are not
        guarantees of employment or validated career assessments.
      </p>
    </Frame>
  );
}

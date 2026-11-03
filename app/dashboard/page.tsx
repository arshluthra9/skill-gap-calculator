"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Skill = {
  name: string;
  rating: number;
};

type DashboardData = {
  assessments: number;
  skills: number;
  roadmapDays: number;
  completedDays: number;
  courses: number;
  career: string;
  careerMatch: number;
  strongSkills: Skill[];
  improvingSkills: Skill[];
};

const initialData: DashboardData = {
  assessments: 0,
  skills: 0,
  roadmapDays: 30,
  completedDays: 0,
  courses: 0,
  career: "Not available yet",
  careerMatch: 0,
  strongSkills: [],
  improvingSkills: [],
};

export default function Dashboard() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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

      if (userError || !userData.user) {
        setMessage("Please log in to view your student dashboard.");
        setLoading(false);
        return;
      }

      const userId = userData.user.id;

      const [
        assessmentResult,
        skillResult,
        progressResult,
        roadmapResult,
      ] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, answers, status, updated_at")
          .eq("student_id", userId)
          .order("updated_at", { ascending: false }),

        supabase
          .from("skills")
          .select("id, name"),

        supabase
          .from("progress_entries")
          .select("activity")
          .eq("student_id", userId),

        supabase
          .from("roadmaps")
          .select("id, plan")
          .eq("student_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (assessmentResult.error) throw assessmentResult.error;
      if (skillResult.error) throw skillResult.error;
      if (progressResult.error) throw progressResult.error;
      if (roadmapResult.error) throw roadmapResult.error;

      const assessments = assessmentResult.data || [];
      const skills = skillResult.data || [];
      const activities = progressResult.data || [];

      const completedAssessments = assessments.filter(
        (item) => item.status === "completed"
      );

      const latestAssessment = completedAssessments[0];

      const ratings: Record<string, number> =
        (latestAssessment?.answers as any)?.ratings || {};

      const strongSkills: Skill[] = [];
      const improvingSkills: Skill[] = [];

      skills.forEach((skill: any) => {
        const rating = Number(ratings[skill.name] || 0);

        if (rating >= 4) {
          strongSkills.push({
            name: skill.name,
            rating,
          });
        } else {
          improvingSkills.push({
            name: skill.name,
            rating,
          });
        }
      });

      const roadmapPlan = roadmapResult.data?.plan as any;
      const roadmapDays = roadmapPlan?.days || [];

      const completedDays = roadmapDays.filter(
        (day: any) => day.completed
      ).length;

      const completedCourses = activities.filter(
        (item: any) =>
          item.activity?.startsWith("Completed course: ")
      ).length;

      let bestCareer = "Complete your assessment";
      let bestMatch = 0;

      if (latestAssessment) {
        const { data: requirements, error: requirementsError } =
          await supabase
            .from("career_skill_requirements")
            .select(
              "required_level, weight, career_roles(title), skills(name)"
            );

        if (requirementsError) throw requirementsError;

        const scores: Record<
          string,
          { earned: number; total: number }
        > = {};

        (requirements as any[] || []).forEach((item) => {
          const title = item.career_roles?.title;
          const skillName = item.skills?.name;

          if (!title || !skillName) return;

          if (!scores[title]) {
            scores[title] = { earned: 0, total: 0 };
          }

          const rating = Number(ratings[skillName] || 0);
          const required = Math.max(
            Number(item.required_level || 1),
            1
          );
          const weight = Math.max(
            Number(item.weight || 1),
            0
          );

          scores[title].earned +=
            Math.min(rating / required, 1) * weight;

          scores[title].total += weight;
        });

        const matches = Object.entries(scores)
          .map(([title, score]) => ({
            title,
            percentage: score.total
              ? Math.round(
                  (score.earned / score.total) * 100
                )
              : 0,
          }))
          .sort((a, b) => b.percentage - a.percentage);

        if (matches.length > 0) {
          bestCareer = matches[0].title;
          bestMatch = matches[0].percentage;
        }
      }

      setData({
        assessments: completedAssessments.length,
        skills: skills.length,
        roadmapDays: roadmapDays.length || 30,
        completedDays,
        courses: completedCourses,
        career: bestCareer,
        careerMatch: bestMatch,
        strongSkills: strongSkills.sort(
          (a, b) => b.rating - a.rating
        ),
        improvingSkills: improvingSkills.sort(
          (a, b) => a.rating - b.rating
        ),
      });
    } catch (error: unknown) {
      console.error("Dashboard error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load your dashboard."
      );
    }

    setLoading(false);
  }

  const stats = [
    ["Assessments completed", data.assessments],
    ["Skills tracked", data.skills],
    ["Roadmap days completed", data.completedDays],
    ["Courses completed", data.courses],
  ];

  const roadmapProgress = data.roadmapDays
    ? Math.round(
        (data.completedDays / data.roadmapDays) * 100
      )
    : 0;

  return (
    <Frame>
      <div className="eyebrow">STUDENT WORKSPACE</div>

      <h1>Your learning dashboard</h1>

      <p className="muted">
        Track your skills, explore career opportunities and
        keep moving towards your goals.
      </p>

      {loading ? (
        <div className="card" style={{ marginTop: 24 }}>
          Loading your dashboard...
        </div>
      ) : (
        <>
          {message && (
            <div className="card" style={{ marginTop: 20 }}>
              {message}
              <p>
                <button
                  className="button"
                  onClick={loadDashboard}
                >
                  Try again
                </button>
              </p>
            </div>
          )}

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              marginTop: 28,
            }}
          >
            {stats.map(([label, value]) => (
              <div className="card" key={label}>
                <div className="muted">{label}</div>
                <div className="stat">{value}</div>
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, 1fr))",
              marginTop: 28,
            }}
          >
            <div className="card">
              <div className="eyebrow">YOUR TOP CAREER MATCH</div>
              <h2>{data.career}</h2>

              {data.assessments > 0 ? (
                <>
                  <div className="stat">
                    {data.careerMatch}%
                  </div>
                  <p className="muted">
                    Indicative skill match based on your
                    self-reported assessment.
                  </p>
                </>
              ) : (
                <p className="muted">
                  Complete your assessment to discover
                  your career matches.
                </p>
              )}

              <Link className="btn" href="/results">
                View career results
              </Link>
            </div>

            <div className="card">
              <div className="eyebrow">LEARNING ROADMAP</div>
              <h2>Your progress</h2>

              <div className="stat">
                {roadmapProgress}%
              </div>

              <p className="muted">
                {data.completedDays} of {data.roadmapDays} days completed
              </p>

              <div
                style={{
                  height: 10,
                  background: "var(--line)",
                  borderRadius: 20,
                  overflow: "hidden",
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${roadmapProgress}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <Link className="btn" href="/roadmap">
                  Open roadmap
                </Link>
              </div>
            </div>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              marginTop: 28,
            }}
          >
            <div className="card">
              <div className="eyebrow">YOUR STRONG SKILLS</div>
              <h2>Doing well in</h2>

              {data.strongSkills.length ? (
                data.strongSkills.map((skill) => (
                  <div
                    key={skill.name}
                    style={{ marginTop: 14 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong>{skill.name}</strong>
                      <span>{skill.rating}/5</span>
                    </div>

                    <div
                      style={{
                        height: 7,
                        background: "var(--line)",
                        borderRadius: 20,
                        marginTop: 7,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${skill.rating * 20}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Complete your assessment to see your
                  strongest skills.
                </p>
              )}
            </div>

            <div className="card">
              <div className="eyebrow">SKILLS TO IMPROVE</div>
              <h2>Focus areas</h2>

              {data.improvingSkills.length ? (
                data.improvingSkills.slice(0, 6).map((skill) => (
                  <div
                    key={skill.name}
                    style={{ marginTop: 14 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong>{skill.name}</strong>
                      <span>{skill.rating}/5</span>
                    </div>

                    <div
                      style={{
                        height: 7,
                        background: "var(--line)",
                        borderRadius: 20,
                        marginTop: 7,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${skill.rating * 20}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Complete your assessment to identify
                  improvement areas.
                </p>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 28 }}>
            <div className="eyebrow">QUICK ACTIONS</div>
            <h2>What would you like to do next?</h2>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 18,
              }}
            >
              <Link className="btn" href="/assessment">
                Take assessment
              </Link>

              <Link className="btn" href="/careers">
                Explore careers
              </Link>

              <Link className="btn" href="/courses">
                Find free courses
              </Link>

              <Link className="btn" href="/roadmap">
                View roadmap
              </Link>

              <Link className="btn" href="/progress">
                Track progress
              </Link>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 24 }}>
            Dashboard figures are based on your saved account
            data. Career matches are indicative guidance, not
            guarantees of employment or validated psychometric
            results.
          </p>
        </>
      )}
    </Frame>
  );
}

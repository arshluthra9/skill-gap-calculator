"use client";

import { useEffect, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type RoadmapDay = {
  day: number;
  title: string;
  task: string;
  skill: string;
  completed: boolean;
};

type RoadmapPlan = {
  career?: string;
  days?: RoadmapDay[];
};

type SkillRequirement = {
  required_level: number;
  weight: number;
  career_roles: { title: string } | null;
  skills: { name: string } | null;
};

const weeklyTitles = [
  "Build your foundation",
  "Practise your skills",
  "Apply what you learned",
  "Review and improve",
];

const tasks = [
  "Understand the basics and learn key concepts.",
  "Watch beginner lessons and make short notes.",
  "Practise simple exercises.",
  "Solve practical examples.",
  "Revise the concepts you learned.",
  "Complete a guided practice activity.",
  "Review your progress and identify weak areas.",
  "Practise with a real-world example.",
  "Build a small project using this skill.",
  "Improve your project and fix mistakes.",
  "Prepare a short explanation of what you learned.",
  "Review your work and update your skill rating.",
];

export default function Roadmap() {
  const [days, setDays] = useState<RoadmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [career, setCareer] = useState("Your target career");
  const [roadmapId, setRoadmapId] = useState<string | null>(null);

  useEffect(() => {
    loadRoadmap();
  }, []);

  async function loadRoadmap() {
    setLoading(true);
    setMessage("");

    if (!supabase) {
      setMessage("Supabase is not configured. Please try again later.");
      setLoading(false);
      return;
    }

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setMessage("Please log in to view your learning roadmap.");
        setLoading(false);
        return;
      }

      const userId = userData.user.id;

      // Load an existing roadmap first.
      const { data: existing, error: existingError } =
        await supabase
          .from("roadmaps")
          .select("id, title, plan")
          .eq("student_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (existingError) throw existingError;

      const existingPlan = existing?.plan as RoadmapPlan | null;

      if (existing && existingPlan?.days?.length) {
        setDays(existingPlan.days);
        setCareer(existingPlan.career || "Your target career");
        setRoadmapId(existing.id);
        setLoading(false);
        return;
      }

      // Find the student's latest completed assessment.
      const { data: assessment, error: assessmentError } =
        await supabase
          .from("assessments")
          .select("id, answers")
          .eq("student_id", userId)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (assessmentError) throw assessmentError;

      if (!assessment) {
        setMessage(
          "Complete your skill assessment first to generate your roadmap."
        );
        setLoading(false);
        return;
      }

      const ratings =
        (assessment.answers as Record<string, any>)?.ratings || {};

      // Load available skills.
      const { data: skills, error: skillsError } =
        await supabase
          .from("skills")
          .select("id, name");

      if (skillsError) throw skillsError;

      // Load career skill requirements.
      const { data: requirements, error: requirementsError } =
        await supabase
          .from("career_skill_requirements")
          .select(
            "required_level, weight, career_roles(title), skills(name)"
          );

      if (requirementsError) throw requirementsError;

      const careerScores: Record<
        string,
        { score: number; total: number }
      > = {};

      (requirements as unknown as SkillRequirement[] || []).forEach(
        (item) => {
          const title = item.career_roles?.title;
          const skillName = item.skills?.name;

          if (!title || !skillName) return;

          if (!careerScores[title]) {
            careerScores[title] = { score: 0, total: 0 };
          }

          const rating = Number(ratings[skillName] || 0);
          const required = Math.max(
            Number(item.required_level || 1),
            1
          );
          const weight = Math.max(Number(item.weight || 1), 0);

          careerScores[title].score +=
            Math.min(rating / required, 1) * weight;

          careerScores[title].total += weight;
        }
      );

      const bestCareer = Object.entries(careerScores).sort(
        (a, b) => {
          const scoreA = a[1].total
            ? a[1].score / a[1].total
            : 0;

          const scoreB = b[1].total
            ? b[1].score / b[1].total
            : 0;

          return scoreB - scoreA;
        }
      )[0];

      const targetCareer =
        bestCareer?.[0] || "Career development";

      setCareer(targetCareer);

      // Identify skills that need improvement.
      const priorities = (skills || [])
        .map((skill: { id: string; name: string }) => ({
          name: skill.name,
          rating: Number(ratings[skill.name] || 0),
        }))
        .filter((skill) => skill.rating < 4)
        .sort((a, b) => a.rating - b.rating)
        .slice(0, 5);

      const selectedPriorities = priorities.length
        ? priorities
        : [{ name: "Practical project work", rating: 3 }];

      // Generate 30 days of learning activities.
      const generatedDays: RoadmapDay[] = Array.from(
        { length: 30 },
        (_, index) => {
          const priority =
            selectedPriorities[index % selectedPriorities.length];

          const isReviewDay = index % 7 === 6;

          return {
            day: index + 1,
            title: isReviewDay
              ? `Day ${index + 1}: Weekly review`
              : `Day ${index + 1}: ${priority.name}`,
            task: isReviewDay
              ? `Review your progress in ${priority.name}. Practise again where needed.`
              : tasks[index % tasks.length],
            skill: priority.name,
            completed: false,
          };
        }
      );

      const plan: RoadmapPlan & {
        created_at: string;
      } = {
        career: targetCareer,
        days: generatedDays,
        created_at: new Date().toISOString(),
      };

      // Save the generated roadmap.
      const { data: saved, error: saveError } =
        await supabase
          .from("roadmaps")
          .insert({
            student_id: userId,
            assessment_id: assessment.id,
            title: `30-day roadmap for ${targetCareer}`,
            plan,
          })
          .select("id")
          .single();

      if (saveError) throw saveError;

      setDays(generatedDays);
      setRoadmapId(saved.id);
      setMessage("Your personalised roadmap has been created!");
    } catch (error: unknown) {
      console.error("Roadmap error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    }

    setLoading(false);
  }

  async function toggleDay(dayNumber: number) {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (!roadmapId) return;

    const previousDays = days;

    const updatedDays = days.map((day) =>
      day.day === dayNumber
        ? { ...day, completed: !day.completed }
        : day
    );

    setDays(updatedDays);
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("roadmaps")
      .update({
        plan: {
          career,
          days: updatedDays,
          updated_at: new Date().toISOString(),
        },
      })
      .eq("id", roadmapId);

    if (error) {
      setDays(previousDays);
      setMessage("Progress could not be saved. Please try again.");
    }

    setSaving(false);
  }

  const completed = days.filter((day) => day.completed).length;

  const progress = days.length
    ? Math.round((completed / days.length) * 100)
    : 0;

  return (
    <Frame>
      <div className="eyebrow">PERSONALISED LEARNING PLAN</div>

      <h1>Your 30-day learning roadmap</h1>

      <p className="muted">
        Build the skills you need, one day at a time.
      </p>

      {loading ? (
        <div className="card" style={{ marginTop: 24 }}>
          Creating your learning roadmap...
        </div>
      ) : (
        <>
          {message && (
            <div className="card" style={{ marginTop: 24 }}>
              {message}
            </div>
          )}

          {days.length > 0 && (
            <>
              <div className="card" style={{ marginTop: 24 }}>
                <div className="eyebrow">YOUR TARGET CAREER</div>

                <h2>{career}</h2>

                <p className="muted">
                  {completed} of 30 days completed
                </p>

                <div
                  style={{
                    height: 10,
                    background: "var(--line)",
                    borderRadius: 20,
                    overflow: "hidden",
                    marginTop: 14,
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "var(--accent)",
                      borderRadius: 20,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <p style={{ marginTop: 10 }}>
                  {progress}% completed
                </p>

                {saving && (
                  <p className="muted">Saving your progress...</p>
                )}
              </div>

              {weeklyTitles.map((weekTitle, week) => (
                <section
                  key={week}
                  style={{ marginTop: 32 }}
                >
                  <div className="eyebrow">
                    WEEK {week + 1}
                  </div>

                  <h2>{weekTitle}</h2>

                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                    }}
                  >
                    {days
                      .filter(
                        (day) =>
                          day.day >= week * 7 + 1 &&
                          day.day <=
                            (week === 3 ? 30 : (week + 1) * 7)
                      )
                      .map((day) => (
                        <div
                          className="card"
                          key={day.day}
                          style={{
                            opacity: day.completed ? 0.75 : 1,
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "flex-start",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={day.completed}
                              onChange={() => toggleDay(day.day)}
                              style={{ marginTop: 5 }}
                            />

                            <span>
                              <strong>{day.title}</strong>

                              <p className="muted">
                                {day.task}
                              </p>

                              <small className="muted">
                                Skill: {day.skill}
                              </small>
                            </span>
                          </label>
                        </div>
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </Frame>
  );
}

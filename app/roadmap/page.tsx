"use client";

import { useEffect, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Skill = {
  id: string;
  name: string;
};

type RoadmapDay = {
  day: number;
  title: string;
  task: string;
  skill: string;
  completed: boolean;
};

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

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setMessage("Please log in to view your learning roadmap.");
        setLoading(false);
        return;
      }

      const userId = userData.user.id;

      const { data: existing } = await supabase
        .from("roadmaps")
        .select("id, title, plan")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.plan?.days?.length) {
        setDays(existing.plan.days);
        setCareer(existing.plan.career || "Your target career");
        setRoadmapId(existing.id);
        setLoading(false);
        return;
      }

      const { data: assessment, error: assessmentError } =
        await supabase
          .from("assessments")
          .select("id, answers")
          .eq("student_id", userId)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (assessmentError || !assessment) {
        setMessage("Complete your skill assessment first to generate your roadmap.");
        setLoading(false);
        return;
      }

      const ratings = assessment.answers?.ratings || {};

      const { data: skills, error: skillsError } = await supabase
        .from("skills")
        .select("id, name");

      if (skillsError || !skills) {
        throw new Error("Could not load your skills.");
      }

      const { data: requirements, error: requirementsError } =
        await supabase
          .from("career_skill_requirements")
          .select("career_id, required_level, weight, career_roles(title), skills(name)");

      if (requirementsError) {
        throw new Error("Could not load career skill requirements.");
      }

      const careerScores: Record<string, {
        title: string;
        score: number;
        total: number;
      }> = {};

      (requirements || []).forEach((item: any) => {
        const title = item.career_roles?.title;
        const skillName = item.skills?.name;

        if (!title || !skillName) return;

        if (!careerScores[title]) {
          careerScores[title] = { title, score: 0, total: 0 };
        }

        const rating = Number(ratings[skillName] || 0);
        const required = Math.max(Number(item.required_level || 1), 1);
        const weight = Math.max(Number(item.weight || 1), 0);

        careerScores[title].score +=
          Math.min(rating / required, 1) * weight;
        careerScores[title].total += weight;
      });

      const bestCareer = Object.values(careerScores)
        .sort((a, b) =>
          (b.total ? b.score / b.total : 0) -
          (a.total ? a.score / a.total : 0)
        )[0];

      const targetCareer = bestCareer?.title || "Career development";
      setCareer(targetCareer);

      const gaps = (skills as Skill[])
        .map((skill) => ({
          name: skill.name,
          rating: Number(ratings[skill.name] || 0),
        }))
        .filter((skill) => skill.rating < 4)
        .sort((a, b) => a.rating - b.rating);

      const priorities = gaps.length
        ? gaps.slice(0, 5)
        : [{ name: "Practical project work", rating: 3 }];

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

      const generatedDays: RoadmapDay[] = Array.from(
        { length: 30 },
        (_, index) => {
          const priority = priorities[index % priorities.length];

          return {
            day: index + 1,
            title:
              index % 7 === 6
                ? "Weekly review"
                : `Day ${index + 1}: ${priority.name}`,
            task:
              index % 7 === 6
                ? `Review your progress in ${priority.name}. Practise again where needed.`
                : tasks[index % tasks.length],
            skill: priority.name,
            completed: false,
          };
        }
      );

      const plan = {
        career: targetCareer,
        days: generatedDays,
        created_at: new Date().toISOString(),
      };

      const { data: saved, error: saveError } = await supabase
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
    } catch (error: any) {
      setMessage(error.message || "Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  async function toggleDay(dayNumber: number) {
    const updatedDays = days.map((day) =>
      day.day === dayNumber
        ? { ...day, completed: !day.completed }
        : day
    );

    setDays(updatedDays);

    if (!roadmapId) return;

    setSaving(true);

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
        <div className="card">Creating your roadmap...</div>
      ) : (
        <>
          {message && (
            <div className="card" style={{ marginTop: 20 }}>
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
                    marginTop: 12,
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "var(--accent)",
                      borderRadius: 20,
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

              {[0, 1, 2, 3].map((week) => (
                <section key={week} style={{ marginTop: 28 }}>
                  <div className="eyebrow">
                    WEEK {week + 1}
                  </div>
                  <h2>
                    {[
                      "Build your foundation",
                      "Practise your skills",
                      "Apply what you learned",
                      "Review and improve",
                    ][week]}
                  </h2>

                  <div className="grid" style={{
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                  }}>
                    {days
                      .filter(
                        (day) =>
                          day.day >= week * 7 + 1 &&
                          day.day <= (week + 1) * 7
                      )
                      .map((day) => (
                        <div className="card" key={day.day}>
                          <label style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            cursor: "pointer",
                          }}>
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

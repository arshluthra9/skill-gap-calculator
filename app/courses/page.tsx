"use client";

import { useEffect, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Course = {
  title: string;
  platform: string;
  skill: string;
  level: string;
  access: string;
  certificate: string;
  url: string;
};

const courses: Course[] = [
  {
    title: "Excel Skills for Business",
    platform: "Coursera",
    skill: "Excel",
    level: "Beginner",
    access: "Audit availability varies",
    certificate: "Certificate may require payment",
    url: "https://www.coursera.org/specializations/excel",
  },
  {
    title: "SQLBolt",
    platform: "SQLBolt",
    skill: "SQL",
    level: "Beginner",
    access: "Free interactive lessons",
    certificate: "No certificate advertised",
    url: "https://sqlbolt.com/",
  },
  {
    title: "Python",
    platform: "Kaggle Learn",
    skill: "Python",
    level: "Beginner",
    access: "Free micro-course",
    certificate: "Check current provider terms",
    url: "https://www.kaggle.com/learn/python",
  },
  {
    title: "Data Visualization",
    platform: "Kaggle Learn",
    skill: "Data visualisation",
    level: "Beginner",
    access: "Free micro-course",
    certificate: "Check current provider terms",
    url: "https://www.kaggle.com/learn/data-visualization",
  },
  {
    title: "Digital Marketing",
    platform: "HubSpot Academy",
    skill: "Marketing",
    level: "Beginner",
    access: "Free learning resources",
    certificate: "Certificate on selected courses",
    url: "https://academy.hubspot.com/",
  },
  {
    title: "Communication Skills",
    platform: "HP LIFE",
    skill: "Communication",
    level: "Beginner",
    access: "Free courses",
    certificate: "Certificate on selected courses",
    url: "https://www.life-global.org/",
  },
  {
    title: "Financial Accounting",
    platform: "AccountingCoach",
    skill: "Financial accounting",
    level: "Beginner",
    access: "Free learning resources",
    certificate: "Check provider options",
    url: "https://www.accountingcoach.com/",
  },
  {
    title: "PowerPoint Training",
    platform: "Microsoft",
    skill: "PowerPoint",
    level: "Beginner",
    access: "Free learning resources",
    certificate: "No course certificate promised",
    url: "https://support.microsoft.com/powerpoint",
  },
];

const completionPrefix = "Completed course: ";

export default function Courses() {
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState("");
  const [message, setMessage] = useState("");
  const [weakSkills, setWeakSkills] = useState<string[]>([]);
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
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
        setMessage("Please log in to see your personalised courses.");
        setLoading(false);
        return;
      }

      const userId = userData.user.id;

      const { data: assessment, error: assessmentError } =
        await supabase
          .from("assessments")
          .select("answers")
          .eq("student_id", userId)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (assessmentError) throw assessmentError;

      if (!assessment) {
        setMessage(
          "Complete your skill assessment to get personalised course recommendations."
        );
        setLoading(false);
        return;
      }

      const ratings =
        (assessment.answers as Record<string, any>)?.ratings || {};

      const gaps = Object.entries(ratings)
        .filter(([, rating]) => Number(rating) < 4)
        .map(([skill]) => skill);

      setWeakSkills(gaps);

      const { data: progress, error: progressError } =
        await supabase
          .from("progress_entries")
          .select("activity")
          .eq("student_id", userId);

      if (progressError) throw progressError;

      const completed = (progress || [])
        .map((item: { activity: string }) => {
          if (!item.activity?.startsWith(completionPrefix)) {
            return null;
          }

          return item.activity.slice(completionPrefix.length);
        })
        .filter((title): title is string => Boolean(title));

      setCompletedCourses(completed);
    } catch (error: unknown) {
      console.error("Course finder error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load your course recommendations."
      );
    }

    setLoading(false);
  }

  async function markCompleted(course: Course) {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    if (completedCourses.includes(course.title)) return;

    setSavingCourse(course.title);
    setMessage("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("Please log in first.");
      }

      const { error: insertError } = await supabase
        .from("progress_entries")
        .insert({
          student_id: userData.user.id,
          skill_id: null,
          activity: `${completionPrefix}${course.title}`,
          completed_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      setCompletedCourses((previous) => [
        ...previous,
        course.title,
      ]);

      setMessage(`${course.title} marked as completed!`);
    } catch (error: unknown) {
      console.error("Course completion error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save course completion."
      );
    }

    setSavingCourse("");
  }

  const recommended = courses.filter((course) =>
    weakSkills.some(
      (skill) =>
        skill.toLowerCase() === course.skill.toLowerCase()
    )
  );

  const displayedCourses = showAll
    ? courses
    : recommended.length
      ? recommended
      : courses;

  return (
    <Frame>
      <div className="eyebrow">PERSONALISED COURSE FINDER</div>

      <h1>Learn new skills without breaking the bank.</h1>

      <p className="muted">
        Courses are matched to skills you may want to improve.
        Check each provider's current access and certificate terms.
      </p>

      {loading ? (
        <div className="card" style={{ marginTop: 24 }}>
          Finding courses for you...
        </div>
      ) : (
        <>
          {message && (
            <div className="card" style={{ marginTop: 20 }}>
              {message}
            </div>
          )}

          {weakSkills.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <div className="eyebrow">YOUR SKILL GAPS</div>
              <h2>Skills to work on</h2>

              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}>
                {weakSkills.map((skill) => (
                  <span className="pill" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 30,
          }}>
            <h2>
              {recommended.length
                ? "Recommended for you"
                : "Explore courses"}
            </h2>

            <button
              className="button"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show recommended" : "Explore all courses"}
            </button>
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              marginTop: 20,
            }}
          >
            {displayedCourses.map((course) => {
              const isCompleted = completedCourses.includes(
                course.title
              );

              return (
                <div className="card" key={course.title}>
                  <div className="eyebrow">
                    {course.platform}
                  </div>

                  <h3>{course.title}</h3>

                  <p className="muted">
                    Skill: {course.skill}
                  </p>

                  <p className="muted">
                    Level: {course.level}
                  </p>

                  <span className="pill">
                    {course.access}
                  </span>

                  <p className="muted" style={{ marginTop: 12 }}>
                    {course.certificate}
                  </p>

                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 18,
                  }}>
                    <a
                      href={course.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button"
                    >
                      Start learning ↗
                    </a>

                    <button
                      className="button"
                      disabled={
                        isCompleted ||
                        savingCourse === course.title
                      }
                      onClick={() => markCompleted(course)}
                    >
                      {isCompleted
                        ? "✓ Completed"
                        : savingCourse === course.title
                          ? "Saving..."
                          : "Mark as completed"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="muted" style={{ marginTop: 24 }}>
            Recommendations use self-reported assessment ratings.
            Course access, pricing and certificates may change.
          </p>
        </>
      )}
    </Frame>
  );
}

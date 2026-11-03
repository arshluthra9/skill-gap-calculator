"use client";

import { useEffect, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Skill = {
  id: string;
  name: string;
};

type Activity = {
  id: string;
  activity: string;
  minutes_spent: number | null;
  completed_at: string;
  skill_id: string | null;
};

export default function Progress() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [skillId, setSkillId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    if (!supabase) {
      setMessage("Database is not configured.");
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setMessage("Please log in to track your progress.");
      setLoading(false);
      return;
    }

    const [skillResult, activityResult] = await Promise.all([
      supabase.from("skills").select("id, name").order("name"),
      supabase
        .from("progress_entries")
        .select("id, activity, minutes_spent, completed_at, skill_id")
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false }),
    ]);

    if (skillResult.error) {
      setMessage(skillResult.error.message);
    } else {
      setSkills(skillResult.data || []);
    }

    if (activityResult.error) {
      setMessage(activityResult.error.message);
    } else {
      setActivities(activityResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!supabase) return;

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setMessage("Please log in first.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("progress_entries").insert({
      student_id: authData.user.id,
      activity: title.trim(),
      minutes_spent: minutes ? Number(minutes) : null,
      skill_id: skillId || null,
      completed_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTitle("");
    setMinutes("30");
    setSkillId("");
    setMessage("Activity added successfully!");
    await loadData();
  }

  const totalMinutes = activities.reduce(
    (sum, item) => sum + (item.minutes_spent || 0),
    0
  );

  const completedActivities = activities.length;

  return (
    <Frame>
      <div className="eyebrow">Progress tracker</div>
      <h1>Your learning journey, in numbers.</h1>
      <p className="muted">
        Track your practice, projects and learning activities.
      </p>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          marginTop: 24,
        }}
      >
        <div className="card">
          <p className="muted">Activities completed</p>
          <h2>{completedActivities}</h2>
        </div>

        <div className="card">
          <p className="muted">Learning time</p>
          <h2>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</h2>
        </div>

        <div className="card">
          <p className="muted">Skills tracked</p>
          <h2>
            {new Set(
              activities.map((a) => a.skill_id).filter(Boolean)
            ).size}
          </h2>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Log a learning activity</h2>
        <p className="muted">
          Add a practice session, project or anything you have learned.
        </p>

        <form onSubmit={addActivity} className="grid" style={{ gap: 14 }}>
          <input
            className="input"
            placeholder="Activity name (e.g. Practised Excel)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <input
            className="input"
            type="number"
            min="1"
            max="1440"
            placeholder="Minutes spent"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />

          <select
            className="input"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
          >
            <option value="">Select a skill (optional)</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>

          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Add activity"}
          </button>
        </form>

        {message && <p className="muted" style={{ marginTop: 12 }}>{message}</p>}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Activity history</h2>

        {loading ? (
          <p className="muted">Loading your progress...</p>
        ) : activities.length === 0 ? (
          <p className="muted">
            No activities yet. Add your first learning activity above!
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            {activities.map((item) => {
              const skill = skills.find((s) => s.id === item.skill_id);

              return (
                <div
                  key={item.id}
                  style={{
                    padding: 14,
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                >
                  <h3>{item.activity}</h3>
                  <p className="muted">
                    {skill ? `Skill: ${skill.name} · ` : ""}
                    {item.minutes_spent || 0} minutes ·{" "}
                    {new Date(item.completed_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <a className="btn" href="/dashboard">Go to dashboard</a>
      </div>
    </Frame>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Frame } from "@/components/Frame";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  roll_number: string | null;
  role: string | null;
  created_at?: string;
};

type Assessment = {
  id: string;
  student_id: string;
  status: string;
  created_at: string;
  answers: Record<string, any> | null;
};

type Skill = {
  id: string;
  name: string;
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [authorised, setAuthorised] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<Profile[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState("");
  const [degreeFilter, setDegreeFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard() {
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setError("Please log in with your admin account.");
      setLoading(false);
      return;
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (adminError || !adminRecord) {
      setError("Access denied. This account is not an administrator.");
      setLoading(false);
      return;
    }

    setAuthorised(true);

    const [profileResult, assessmentResult, skillResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, roll_number, role, created_at")
          .order("full_name"),

        supabase
          .from("assessments")
          .select("id, student_id, status, created_at, answers")
          .order("created_at", { ascending: false }),

        supabase.from("skills").select("id, name").order("name"),
      ]);

    if (profileResult.error) {
      setError("Could not load students: " + profileResult.error.message);
    } else {
      setStudents(profileResult.data || []);
    }

    if (assessmentResult.error) {
      setError("Could not load assessments: " + assessmentResult.error.message);
    } else {
      setAssessments(assessmentResult.data || []);
    }

    if (skillResult.error) {
      setError("Could not load skills: " + skillResult.error.message);
    } else {
      setSkills(skillResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function refreshData() {
    setRefreshing(true);
    setError("");
    await loadDashboard();
    setRefreshing(false);
  }

  const studentProfiles = students.filter(
    (student) => student.role === "student"
  );

  const completedAssessments = assessments.filter(
    (item) => item.status === "completed"
  );

  const inProgressAssessments = assessments.filter(
    (item) => item.status === "in_progress"
  );

  function getDegree(studentId: string) {
    const assessment = completedAssessments.find(
      (item) => item.student_id === studentId
    );

    const answers = assessment?.answers || {};

    return (
      answers.degree ||
      answers.academic?.degree ||
      answers.academicProfile?.degree ||
      "Not specified"
    );
  }

  const degrees = Array.from(
    new Set(studentProfiles.map((student) => getDegree(student.id)))
  ).sort();

  const filteredStudents = useMemo(() => {
    const term = search.toLowerCase().trim();

    return studentProfiles.filter((student) => {
      const matchesSearch =
        !term ||
        (student.full_name || "").toLowerCase().includes(term) ||
        (student.email || "").toLowerCase().includes(term) ||
        (student.roll_number || "").toLowerCase().includes(term);

      const matchesDegree =
        degreeFilter === "All" ||
        getDegree(student.id) === degreeFilter;

      return matchesSearch && matchesDegree;
    });
  }, [students, assessments, search, degreeFilter]);

  const degreeCounts: Record<string, number> = {};

  completedAssessments.forEach((item) => {
    const answers = item.answers || {};
    const degree =
      answers.degree ||
      answers.academic?.degree ||
      answers.academicProfile?.degree ||
      "Not specified";

    degreeCounts[degree] = (degreeCounts[degree] || 0) + 1;
  });

  const ratingTotals: Record<string, { total: number; count: number }> = {};

  completedAssessments.forEach((item) => {
    const ratings = item.answers?.ratings || {};

    Object.entries(ratings).forEach(([skillName, rawRating]) => {
      const rating = Number(rawRating);
      if (!Number.isFinite(rating)) return;

      if (!ratingTotals[skillName]) {
        ratingTotals[skillName] = { total: 0, count: 0 };
      }

      ratingTotals[skillName].total += rating;
      ratingTotals[skillName].count += 1;
    });
  });

  const skillGaps = Object.entries(ratingTotals)
    .map(([name, data]) => ({
      name,
      average: data.total / data.count,
      count: data.count,
    }))
    .filter((item) => item.average < 3)
    .sort((a, b) => a.average - b.average);

  const recentStudents = [...studentProfiles]
    .sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || "")
    )
    .slice(0, 8);

  if (loading) {
    return (
      <Frame>
        <p className="muted">Loading admin dashboard...</p>
      </Frame>
    );
  }

  if (!authorised) {
    return (
      <Frame>
        <div className="eyebrow">Administration</div>
        <h1>Admin access required</h1>
        <div className="card">
          <p className="muted">{error || "You are not authorised to view this page."}</p>
          <a className="btn" href="/login">Go to login</a>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="eyebrow">Administration · Overview</div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted">
            Monitor students, assessments and skill development.
          </p>
        </div>

        <button className="btn" onClick={refreshData} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">{error}</p>
        </div>
      )}

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          marginTop: 24,
        }}
      >
        <div className="card">
          <p className="muted">Registered students</p>
          <h2>{studentProfiles.length}</h2>
        </div>

        <div className="card">
          <p className="muted">Completed assessments</p>
          <h2>{completedAssessments.length}</h2>
        </div>

        <div className="card">
          <p className="muted">In-progress assessments</p>
          <h2>{inProgressAssessments.length}</h2>
        </div>

        <div className="card">
          <p className="muted">Skills in catalogue</p>
          <h2>{skills.length}</h2>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          marginTop: 24,
        }}
      >
        <div className="card">
          <h2>Students by degree</h2>

          {Object.keys(degreeCounts).length === 0 ? (
            <p className="muted">No degree data available yet.</p>
          ) : (
            Object.entries(degreeCounts).map(([degree, count]) => (
              <div
                key={degree}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span>{degree}</span>
                <strong>{count}</strong>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h2>Common skill gaps</h2>
          <p className="muted">
            Skills with an average self-reported rating below 3 out of 5.
          </p>

          {skillGaps.length === 0 ? (
            <p className="muted">No skill-gap data available yet.</p>
          ) : (
            skillGaps.slice(0, 8).map((skill) => (
              <div key={skill.name} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{skill.name}</strong>
                  <span className="muted">{skill.average.toFixed(1)} / 5</span>
                </div>

                <div
                  style={{
                    height: 7,
                    background: "var(--border)",
                    borderRadius: 20,
                    marginTop: 7,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(skill.average / 5) * 100}%`,
                      height: "100%",
                      background: "var(--accent)",
                      borderRadius: 20,
                    }}
                  />
                </div>

                <p className="muted" style={{ fontSize: 12 }}>
                  Based on {skill.count} assessment(s)
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Student Management</h2>
        <p className="muted">
          Search and review registered student accounts.
        </p>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            marginTop: 16,
          }}
        >
          <input
            className="input"
            placeholder="Search name, email or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="input"
            value={degreeFilter}
            onChange={(e) => setDegreeFilter(e.target.value)}
          >
            <option value="All">All degrees</option>
            {degrees.map((degree) => (
              <option key={degree} value={degree}>{degree}</option>
            ))}
          </select>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          Showing {filteredStudents.length} of {studentProfiles.length} students
        </p>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 10 }}>Student</th>
                <th style={{ textAlign: "left", padding: 10 }}>Roll number</th>
                <th style={{ textAlign: "left", padding: 10 }}>Degree</th>
                <th style={{ textAlign: "left", padding: 10 }}>Assessments</th>
                <th style={{ textAlign: "left", padding: 10 }}>Registration</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student) => {
                const studentAssessments = assessments.filter(
                  (item) => item.student_id === student.id
                );

                return (
                  <tr key={student.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: 10 }}>
                      <strong>{student.full_name || "Not available"}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {student.email || "No email"}
                      </div>
                    </td>

                    <td style={{ padding: 10 }}>
                      {student.roll_number || "—"}
                    </td>

                    <td style={{ padding: 10 }}>
                      {getDegree(student.id)}
                    </td>

                    <td style={{ padding: 10 }}>
                      {studentAssessments.length}
                    </td>

                    <td style={{ padding: 10 }}>
                      {student.created_at
                        ? new Date(student.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16 }}>
                    No matching students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Recent student accounts</h2>

        {recentStudents.length === 0 ? (
          <p className="muted">No student accounts found.</p>
        ) : (
          recentStudents.map((student) => (
            <div
              key={student.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong>{student.full_name || "Not available"}</strong>
              <p className="muted" style={{ fontSize: 13 }}>
                {student.email || "No email"} · {student.roll_number || "No roll number"}
              </p>
            </div>
          ))
        )}
      </div>

      <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
        Skill-gap figures are based on student self-assessments. They are
        indicative and are not independently verified skill measurements.
      </p>
    </Frame>
  );
}

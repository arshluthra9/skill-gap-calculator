import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { rollNumber, password } = await request.json();

    if (
      typeof rollNumber !== "string" ||
      typeof password !== "string" ||
      !rollNumber.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: "Roll number and password are required." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !secretKey) {
      return NextResponse.json(
        { error: "Server configuration is missing." },
        { status: 500 }
      );
    }

    // Private server-side client for finding the student's email
    const adminClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const normalizedRoll = rollNumber.trim().toUpperCase();

    const { data: profile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("email")
        .eq("roll_number", normalizedRoll)
        .single();

    if (profileError || !profile?.email) {
      return NextResponse.json(
        { error: "Invalid roll number or password." },
        { status: 401 }
      );
    }

    // Public client for normal student authentication
    const authClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } =
      await authClient.auth.signInWithPassword({
        email: profile.email,
        password,
      });

    if (error || !data.session) {
      return NextResponse.json(
        { error: "Invalid roll number or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process login." },
      { status: 500 }
    );
  }
}

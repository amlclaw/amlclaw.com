import { NextResponse } from "next/server";
import { createPolicy, updatePolicy } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const name = file.name;
    const ext = name.split(".").pop()?.toLowerCase() || "md";
    if (!["md", "txt"].includes(ext)) {
      return NextResponse.json({ error: "Only .md and .txt files are supported" }, { status: 400 });
    }

    const content = await file.text();
    if (!content.trim()) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const jurisdiction = formData.get("jurisdiction") as string || "Custom";

    // Create policy entry via storage layer
    const policy = createPolicy({
      name: name.replace(/\.\w+$/, ""),
      jurisdiction,
      source_documents: [],
    });

    // Save content and mark as ready
    updatePolicy(policy.id, { content, status: "ready" });

    return NextResponse.json({ ...policy, status: "ready" }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}

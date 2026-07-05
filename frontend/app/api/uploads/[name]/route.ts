import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  // path traversal koruması: sadece uuid.ext biçimine izin ver
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(name)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const ext = name.split(".").pop()!;
  const data = fs.readFileSync(filePath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME_BY_EXT[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

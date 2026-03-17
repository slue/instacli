import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";

export async function uploadToFileIo(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(absolutePath));

  const res = await fetch("https://file.io", {
    method: "POST",
    body: form,
  });

  const data = (await res.json()) as {
    success: boolean;
    link?: string;
    message?: string;
  };

  if (!data.success || !data.link) {
    throw new Error(`file.io upload failed: ${data.message || "Unknown error"}`);
  }

  return data.link;
}

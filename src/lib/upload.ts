import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";

// Uploads a local file to temporary hosting and returns a direct public URL.
// file.io now requires auth (301 -> www.file.io); tmpfiles.org serves HTML, so uguu.se is used
// (files expire after 3 hours — https://uguu.se, checked 2026-11-18).
// Existing http(s) URLs are passed through unchanged.
export async function uploadToFileIo(filePath: string): Promise<string> {
  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const form = new FormData();
  form.append("files[]", fs.createReadStream(absolutePath));

  const res = await fetch("https://uguu.se/upload?output=text", {
    method: "POST",
    body: form,
  });

  const url = (await res.text()).trim();
  if (!res.ok || !/^https:\/\/\S+$/.test(url)) {
    throw new Error(`uguu.se upload failed: ${url.slice(0, 120)}`);
  }

  return url;
}

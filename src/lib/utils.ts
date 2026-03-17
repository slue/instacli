import chalk from "chalk";
import path from "path";

export function error(message: string): never {
  console.error(chalk.red(`Error: ${message}`));
  process.exit(1);
}

export function success(message: string): void {
  console.log(chalk.green(message));
}

export function info(message: string): void {
  console.log(chalk.cyan(message));
}

export function warn(message: string): void {
  console.log(chalk.yellow(message));
}

export function isVideo(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return [".mp4", ".mov", ".avi", ".mkv"].includes(ext);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function truncate(str: string | undefined | null, len: number): string {
  if (!str) return "";
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}

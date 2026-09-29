// What's New shows the GitHub release body. Bundled translations of a
// version's body (same markdown shape: `### New|Improved|Fixed` headings and
// `- **Title** — body` items stay parseable) replace it in that language.
import { currentLanguage } from ".";

const koBodies = import.meta.glob<string>("./releaseNotes/ko/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

export function localizedReleaseBody(version: string, githubBody: string): string {
  if (currentLanguage() !== "ko") return githubBody;
  return koBodies[`./releaseNotes/ko/v${version}.md`] ?? githubBody;
}

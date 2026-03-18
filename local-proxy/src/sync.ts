import axios from "axios";
import {
  replaceDangerCommands,
  replaceDisabledSkills,
  replaceDeprecatedSkills,
  replaceUserSkills,
  getLocalSettings,
} from "./db.js";

export interface DangerCommandDto {
  id: number;
  commandPattern: string;
  systemType: string;
  category: string;
  riskLevel: string;
  enabled: boolean;
}

interface DangerCommandPage {
  content: DangerCommandDto[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export async function syncDangerCommandsFromServer(apiKey: string): Promise<number> {
  const settings = await getLocalSettings();
  const apiBase = settings?.apiBase ?? "https://api.clawheart.live";
  let page = 0;
  const size = 200;
  const all: DangerCommandDto[] = [];

  for (;;) {
    const url = `${apiBase}/api/danger-commands?page=${page}&size=${size}`;
    const res = await axios.get<DangerCommandPage>(url, {
      headers: {
        "Content-Type": "application/json",
        "X-OC-API-KEY": apiKey,
      },
      validateStatus: () => true,
    });
    if (res.status !== 200 || !res.data.content) {
      break;
    }
    all.push(...res.data.content);
    if (res.data.last || res.data.number + 1 >= res.data.totalPages) {
      break;
    }
    page += 1;
  }

  await replaceDangerCommands(
    all.map((c) => ({
      id: c.id,
      command_pattern: c.commandPattern,
      system_type: c.systemType,
      category: c.category,
      risk_level: c.riskLevel,
      enabled: c.enabled ? 1 : 0,
    }))
  );

  return all.length;
}

export async function syncSystemSkillsStatusFromServer(apiKey: string): Promise<{ disabled: number; deprecated: number }> {
  const settings = await getLocalSettings();
  const apiBase = settings?.apiBase ?? "https://api.clawheart.live";
  const headers = {
    "Content-Type": "application/json",
    "X-OC-API-KEY": apiKey,
  };

  const disabledUrl = `${apiBase}/api/skills/disabled-slugs`;
  const deprecatedUrl = `${apiBase}/api/skills/deprecated-slugs`;

  const [disabledRes, deprecatedRes] = await Promise.all([
    axios.get<string[]>(disabledUrl, { headers, validateStatus: () => true }),
    axios.get<string[]>(deprecatedUrl, { headers, validateStatus: () => true }),
  ]);

  const disabledSlugs = disabledRes.status === 200 && Array.isArray(disabledRes.data) ? disabledRes.data : [];
  const deprecatedSlugs = deprecatedRes.status === 200 && Array.isArray(deprecatedRes.data) ? deprecatedRes.data : [];

  await replaceDisabledSkills(disabledSlugs);
  await replaceDeprecatedSkills(deprecatedSlugs);

  return { disabled: disabledSlugs.length, deprecated: deprecatedSlugs.length };
}

export interface UserSkillDto {
  slug: string;
  enabled: boolean;
}

export async function syncUserSkillsFromServer(apiKey: string): Promise<number> {
  const settings = await getLocalSettings();
  const apiBase = settings?.apiBase ?? "https://api.clawheart.live";
  const headers = {
    "Content-Type": "application/json",
    "X-OC-API-KEY": apiKey,
  };

  const url = `${apiBase}/api/user-skills/me`;
  const res = await axios.get<UserSkillDto[]>(url, { headers, validateStatus: () => true });
  if (res.status !== 200 || !Array.isArray(res.data)) {
    return 0;
  }

  const rows = res.data.map((u) => ({
    slug: u.slug,
    enabled: u.enabled ? 1 : 0,
  }));

  await replaceUserSkills(rows);

  return rows.length;
}


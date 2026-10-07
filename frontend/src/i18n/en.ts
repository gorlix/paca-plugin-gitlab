const en = {
  "settings.title": "GitLab",
  "settings.token.saved": "Access token saved",
  "settings.token.encrypted": "Token is stored encrypted. It is never returned by the API.",
  "settings.token.remove": "Remove token",
  "settings.token.removeTitle": "Remove GitLab token",
  "settings.token.removeBody":
    "Removing the token will also unlink all repositories and disable webhook events. This action cannot be undone.",
  "settings.token.cancel": "Cancel",
  "settings.token.save": "Save token",
  "settings.token.label": "Access token",
  "settings.token.placeholder": "glpat-… or project/group access token",
  "settings.token.kind": "Token type",
  "settings.token.kind.personal": "Personal access token",
  "settings.token.kind.project": "Project access token",
  "settings.token.kind.group": "Group access token",
  "settings.instanceUrl": "GitLab instance URL",
  "settings.instanceUrl.hint": "Default https://gitlab.com — Self-Managed: your instance base URL",
  "settings.token.invalid":
    "GitLab rejected the token. Check scope api and Maintainer/Owner role for webhooks.",
  "settings.token.saveFailed": "Failed to save token. Please try again.",
  "settings.token.removeFailed": "Failed to remove token. Please try again.",
  "settings.repos.title": "Linked projects",
  "settings.repos.link": "Link project",
  "task.section.title": "GitLab",
  "task.mr.link": "Link merge request",
  "task.mr.create": "Create merge request",
  "task.branch.create": "Create branch on GitLab",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
} as const;

export type MessageKey = keyof typeof en;
export default en;

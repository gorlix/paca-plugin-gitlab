const en = {
  "settings.title": "GitLab",
  "settings.integrationTitle": "GitLab Integration",
  "settings.integrationDesc":
    "Link GitLab repositories to track merge requests, create branches from tasks, and receive webhook events automatically. You can link multiple repositories to a single project.",
  "settings.step.connectToken": "Connect a GitLab token",
  "settings.step.linkRepo": "Link a repository",

  "settings.token.saved": "Access token saved",
  "settings.token.encrypted":
    "Token is stored encrypted. It is never returned by the API.",
  "settings.token.remove": "Remove token",
  "settings.token.removeTitle": "Remove GitLab token",
  "settings.token.removeBody":
    "Removing the token will also unlink all repositories and disable webhook events. This action cannot be undone.",
  "settings.token.cancel": "Cancel",
  "settings.token.removing": "Removing…",
  "settings.token.save": "Save token",
  "settings.token.label": "Access token",
  "settings.token.placeholder": "glpat-… or project/group access token",
  "settings.token.kind": "Token type",
  "settings.token.kind.personal": "Personal access token",
  "settings.token.kind.project": "Project access token",
  "settings.token.kind.group": "Group access token",
  "settings.token.scopeHintBefore":
    "Use a Personal, Project, or Group Access Token with scope",
  "settings.token.scopeHintAfter":
    "(Maintainer/Owner required to create project webhooks).",
  "settings.token.show": "show",
  "settings.token.hide": "hide",
  "settings.instanceUrl": "GitLab instance URL",
  "settings.instanceUrl.hint":
    "Default https://gitlab.com — Self-Managed: your instance base URL",
  "settings.token.invalid":
    "GitLab rejected the token. Check scope api and Maintainer/Owner role for webhooks.",
  "settings.token.saveFailed": "Failed to save token. Please try again.",
  "settings.token.removeFailed": "Failed to remove token. Please try again.",

  "settings.repos.title": "Linked Repositories",
  "settings.repos.link": "Add repository",
  "settings.repos.linkFirst": "Add your first repository",
  "settings.repos.empty": "No repositories linked yet.",
  "settings.repos.emptyHint":
    "No repositories linked yet. Link a repository to track merge requests and branches.",
  "settings.repos.webhooksAuto":
    "Webhooks are registered automatically for each linked repository.",
  "settings.repos.reload": "Reload linked repositories",
  "settings.repos.defaultBranch": "Default branch:",

  "settings.addRepo.title": "Add repository",
  "settings.addRepo.desc":
    "Select a repository from your GitLab account to link to this project. A webhook will be registered automatically.",
  "settings.addRepo.search": "Search repositories…",
  "settings.addRepo.reload": "Reload repositories",
  "settings.addRepo.empty": "No accessible repositories found.",
  "settings.addRepo.noMatch": 'No repositories match "{search}"',
  "settings.addRepo.private": "Private",
  "settings.addRepo.close": "Close",
  "settings.addRepo.error.webhookNotPublic":
    "Cannot register webhook because this API URL is not publicly reachable (for example localhost). Configure PUBLIC_URL to a public HTTPS URL and try again.",
  "settings.addRepo.error.webhookFailed":
    "Could not create the webhook. Ensure the token has the api scope, you have Maintainer/Owner on the project, and PUBLIC_URL is a public HTTPS URL GitLab can reach.",
  "settings.addRepo.error.alreadyLinked":
    "This repository is already linked to the project.",
  "settings.addRepo.error.notAccessible":
    "Repository not found or not accessible. Check that your token has the api scope.",
  "settings.addRepo.error.generic": "Failed to link repository. Please try again.",

  "settings.unlink.action": "Unlink",
  "settings.unlink.title": "Unlink repository",
  "settings.unlink.bodyBefore": "This will remove the link to",
  "settings.unlink.bodyAfter":
    "and attempt to delete the webhook from GitLab.",
  "settings.unlink.confirm": "Unlink repository",
  "settings.unlink.unlinking": "Unlinking…",
  "settings.unlink.failed": "Failed to unlink. Please try again.",

  "settings.webhook.hint":
    "Webhooks are registered on all linked repositories. GitLab will push merge_request events to keep MR status in sync automatically.",
  "settings.noIntegration":
    "No GitLab integration configured. Add a personal access token to get started.",

  "task.section.title": "GitLab",
  "task.mr.title": "Merge Requests",
  "task.mr.link": "Link merge request",
  "task.mr.create": "Create merge request",
  "task.mr.empty": "No merge requests linked yet.",
  "task.mr.unlink": "Unlink merge request",
  "task.mr.state.open": "Open",
  "task.mr.state.merged": "Merged",
  "task.mr.state.closed": "Closed",
  "task.mr.by": "by {author}",
  "task.mr.repository": "Repository",
  "task.mr.selectRepo": "Select repository…",
  "task.mr.inputLabel": "PR number or GitLab URL",
  "task.mr.placeholder":
    "42 or https://gitlab.com/owner/repo/-/merge_requests/42",
  "task.mr.willLink": "Will link PR #{number} from {repo}",
  "task.mr.error.noToken": "No GitLab token configured for this project.",
  "task.mr.error.repoNotFound":
    "Repository not found. It may have been unlinked.",
  "task.mr.error.prNotFound":
    "PR #{number} was not found in the selected repository.",
  "task.mr.error.alreadyLinked": "PR #{number} is already linked to this task.",
  "task.mr.error.permissions":
    "Your GitLab token does not have permission to read merge requests. Update it in Project Settings > GitLab.",
  "task.mr.error.generic": "Failed to link merge request. Please try again.",
  "task.mr.error.repoNotLinked":
    'Repository "{name}" is not linked to this project.',
  "task.mr.error.selectRepo": "Select a repository.",
  "task.mr.error.invalidInput":
    "Enter a valid PR number or paste a GitLab PR URL.",

  "task.branch.title": "Branches",
  "task.branch.create": "Create branch on GitLab",
  "task.branch.createShort": "Create branch",
  "task.branch.link": "Link existing branch",
  "task.branch.linkAction": "Link branch",
  "task.branch.empty": "No branches linked yet.",
  "task.branch.type": "Type",
  "task.branch.name": "Branch name",
  "task.branch.repository": "Repository",
  "task.branch.selectRepo": "Select repository…",
  "task.branch.source": "Source branch",
  "task.branch.sourceOptional": "(optional, defaults to repo default)",
  "task.branch.orLocal": "Or create locally:",
  "task.branch.copy": "Copy to clipboard",
  "task.branch.nameOrUrl": "Branch name or GitLab URL",
  "task.branch.placeholder":
    "feature/foo or https://gitlab.com/owner/repo/tree/feature/foo",
  "task.branch.willLink": "Will link branch {branch} from {repo}",
  "task.branch.error.noToken": "No GitLab token configured for this project.",
  "task.branch.error.repoNotFound":
    "Repository not found. It may have been unlinked.",
  "task.branch.error.alreadyLinked":
    "This branch is already linked to the task.",
  "task.branch.error.alreadyLinkedNamed":
    'Branch "{branch}" is already linked to this task.',
  "task.branch.error.notFound":
    'Branch "{branch}" was not found in the selected repository.',
  "task.branch.error.permissionsCreate":
    "Your GitLab token does not have permission to create branches. Update it in Project Settings > GitLab with a token that has the api scope.",
  "task.branch.error.permissionsRead":
    "Your GitLab token does not have permission to read branches. Update it in Project Settings > GitLab.",
  "task.branch.error.createFailed": "Failed to create branch. Please try again.",
  "task.branch.error.linkFailed": "Failed to link branch. Please try again.",
  "task.branch.error.nameRequired": "Branch name is required.",
  "task.branch.error.selectRepo": "Select a repository.",
  "task.branch.error.invalidInput":
    "Enter a branch name or paste a GitLab branch URL.",
  "task.branch.error.repoNotLinked":
    'Repository "{name}" is not linked to this project.',

  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.cancel": "Cancel",
} as const;

export type MessageKey = keyof typeof en;
export default en;

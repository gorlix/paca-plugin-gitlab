import {
	PluginAPIClient,
	type PluginMCPContext,
	type PluginMCPEntry,
	type Tool,
	errorResult,
	textResult,
} from "@paca-ai/plugin-sdk-mcp";

// ── Domain types ──────────────────────────────────────────────────────────────

interface GitLabIntegration {
	id: string;
	project_id: string;
	created_at: string;
	updated_at: string;
}

interface LinkedRepository {
	id: string;
	project_id: string;
	owner: string;
	repo_name: string;
	full_name: string;
	default_branch: string;
	clone_url: string;
	webhook_active: boolean;
	created_at: string;
	updated_at: string;
}


interface PullRequest {
	id: string;
	task_id: string;
	repo_id: string;
	pr_number: number;
	title: string;
	state: "open" | "closed" | "merged";
	html_url: string;
	head_branch: string;
	author: string | null;
	merged_at: string | null;
	created_at: string;
}

interface PullRequestDetails {
	owner: string;
	repo_name: string;
	pr_number: number;
	title: string;
	state: string;
	body: string;
	html_url: string;
	diff: string;
}

interface CICheck {
	name: string;
	status: string;
	conclusion: string;
	url: string;
}

interface PullRequestCIStatus {
	state: string;
	checks: CICheck[];
}

interface TaskBranch {
	id: string;
	task_id: string;
	repo_id: string;
	branch_name: string;
	created_at: string;
}

interface CreateBranchResult {
	branch_name: string;
	repo_full_name: string;
	html_url: string;
}

interface CreatePullRequestResult {
	id: string;
	project_id: string;
	repo_id: string;
	pr_number: number;
	gitlab_pr_id: number;
	title: string;
	state: string;
	html_url: string;
	head_branch: string;
	base_branch: string;
	author: string;
	merged_at: string | null;
	created_at: string;
	updated_at: string;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatIntegration(integration: GitLabIntegration): string {
	return `GitLab Integration:
ID: ${integration.id}
Project ID: ${integration.project_id}
Created: ${integration.created_at}
Updated: ${integration.updated_at}`;
}

function formatLinkedRepo(repo: LinkedRepository): string {
	return `Repository: ${repo.full_name}
ID: ${repo.id}
Owner: ${repo.owner}
Repo Name: ${repo.repo_name}
Default Branch: ${repo.default_branch}
Clone URL: ${repo.clone_url}
Webhook Active: ${repo.webhook_active ? "Yes" : "No"}
Created: ${repo.created_at}`;
}

function formatPullRequest(pr: PullRequest): string {
	return `Merge Request: #${pr.pr_number} - ${pr.title}
ID: ${pr.id}
State: ${pr.state}
Author: ${pr.author ?? "Unknown"}
URL: ${pr.html_url}
Head Branch: ${pr.head_branch}
Created: ${pr.created_at}
Merged: ${pr.merged_at ? `Yes (${pr.merged_at})` : "No"}`;
}

function formatPullRequestDetails(pr: PullRequestDetails): string {
	return `Merge Request: #${pr.pr_number} - ${pr.title} (${pr.owner}/${pr.repo_name})
State: ${pr.state}
URL: ${pr.html_url}
Description: ${pr.body || "(none)"}

Diff:
${pr.diff || "(no changes)"}`;
}

function formatCIStatus(ci: PullRequestCIStatus): string {
	if (ci.checks.length === 0) {
		return "CI status: unknown (no checks found for this commit).";
	}
	const checkLines = ci.checks
		.map((c) => `- ${c.name}: ${c.status}${c.conclusion ? ` (${c.conclusion})` : ""}`)
		.join("\n");
	return `CI status: ${ci.state}\n\n${checkLines}`;
}

function formatBranch(branch: TaskBranch): string {
	return `Branch: ${branch.branch_name}
ID: ${branch.id}
Task ID: ${branch.task_id}
Repo ID: ${branch.repo_id}
Created: ${branch.created_at}`;
}

function formatList<T>(items: T[], formatter: (item: T) => string): string {
	if (items.length === 0) return "(none)";
	return items.map(formatter).join("\n\n---\n\n");
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const UUID_DESC =
	"The technical UUID of the %s (e.g., '550e8400-e29b-41d4-a716-446655440000').";

const projectIdProp = {
	type: "string",
	description:
		UUID_DESC.replace("%s", "project") +
		" Use list_projects to get the project ID. Do NOT use the project name.",
};

const taskIdProp = {
	type: "string",
	description:
		UUID_DESC.replace("%s", "task") + " Use list_tasks to get the task ID.",
};

const tools: Tool[] = [
	// ── Integration ──────────────────────────────────────────────────────────
	{
		name: "gitlab_get_integration",
		description: "Get GitLab integration status for a project.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
			},
			required: ["projectId"],
		},
	},
	{
		name: "gitlab_set_token",
		description:
			"Set (or replace) the GitLab personal access token for a project. The token must have at least the 'repo' scope.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				token: {
					type: "string",
					description: "The GitLab personal access token (e.g., 'ghp_xxxx').",
				},
			},
			required: ["projectId", "token"],
		},
	},
	{
		name: "gitlab_delete_token",
		description: "Delete the GitLab token for a project, removing GitLab integration.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
			},
			required: ["projectId"],
		},
	},
	// ── Repositories ─────────────────────────────────────────────────────────
	{
		name: "gitlab_list_linked_repos",
		description: "List GitLab repositories linked to a project.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
			},
			required: ["projectId"],
		},
	},
	{
		name: "gitlab_link_repository",
		description:
			"Link a GitLab repository to a project. The repository must be accessible with the project's GitLab token.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				owner: {
					type: "string",
					description: "The repository owner (GitLab username or org).",
				},
				repo_name: {
					type: "string",
					description: "The repository name (not including the owner).",
				},
			},
			required: ["projectId", "owner", "repo_name"],
		},
	},
	{
		name: "gitlab_unlink_repository",
		description: "Unlink a GitLab repository from a project.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				repoId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked repository") +
						" Use gitlab_list_linked_repos to get the repo ID.",
				},
			},
			required: ["projectId", "repoId"],
		},
	},
	// ── Merge Requests ─────────────────────────────────────────────────────────
	{
		name: "gitlab_list_task_prs",
		description: "List merge requests linked to a task.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
			},
			required: ["projectId", "taskId"],
		},
	},
	{
		name: "gitlab_link_pr_to_task",
		description: "Link a GitLab merge request to a task.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				repoId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked repository") +
						" Use gitlab_list_linked_repos to get the repo ID.",
				},
				pr_number: {
					type: "number",
					description: "The GitLab merge request number (e.g., 42).",
				},
			},
			required: ["projectId", "taskId", "repoId", "pr_number"],
		},
	},
	{
		name: "gitlab_unlink_pr_from_task",
		description: "Unlink a merge request from a task.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				prId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked merge request") +
						" Use gitlab_list_task_prs to get the PR ID.",
				},
			},
			required: ["projectId", "taskId", "prId"],
		},
	},
	{
		name: "gitlab_create_pull_request",
		description:
			"Create a new merge request on GitLab for a task. The merge request will be created on the linked repository and automatically linked to the task. Returns the PR URL.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				repoId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked repository") +
						" Use gitlab_list_linked_repos to get the repo ID.",
				},
				title: {
					type: "string",
					description:
						"The title for the merge request (e.g., 'feat: add user authentication').",
				},
				head_branch: {
					type: "string",
					description:
						"The name of the branch that contains the changes (the source branch, e.g., 'feat/PROJ-42-add-feature').",
				},
				base_branch: {
					type: "string",
					description:
						"The name of the branch to merge into (the target branch, e.g., 'main' or 'develop').",
				},
				body: {
					type: "string",
					description:
						"The description/body for the merge request in Markdown format (optional).",
				},
			},
			required: ["projectId", "taskId", "repoId", "title", "head_branch", "base_branch"],
		},
	},
	{
		name: "gitlab_get_pull_request",
		description:
			"Fetch a merge request's title, description, state, and diff so it can be reviewed.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				prId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked merge request") +
						" Use gitlab_list_task_prs to get the PR ID.",
				},
			},
			required: ["projectId", "taskId", "prId"],
		},
	},
	{
		name: "gitlab_get_pull_request_ci_status",
		description:
			"Get the CI/check status for a merge request's latest commit (e.g. GitLab Actions runs, other check runs, and legacy commit statuses). Returns an overall state (success, failure, pending, or unknown) plus the individual checks.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				prId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked merge request") +
						" Use gitlab_list_task_prs to get the PR ID.",
				},
			},
			required: ["projectId", "taskId", "prId"],
		},
	},
	{
		name: "gitlab_comment_pull_request",
		description: "Add a general (non-review) comment to a merge request.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				prId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked merge request") +
						" Use gitlab_list_task_prs to get the PR ID.",
				},
				body: {
					type: "string",
					description: "The comment text.",
				},
			},
			required: ["projectId", "taskId", "prId", "body"],
		},
	},
	{
		name: "gitlab_review_pull_request",
		description:
			"Submit a formal review on a merge request (approve, request changes, or comment). Call gitlab_get_pull_request first to see the diff.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				prId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked merge request") +
						" Use gitlab_list_task_prs to get the PR ID.",
				},
				event: {
					type: "string",
					enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
					description: "The review verdict.",
				},
				body: {
					type: "string",
					description:
						"Review summary (required for REQUEST_CHANGES and COMMENT).",
				},
			},
			required: ["projectId", "taskId", "prId", "event"],
		},
	},
	// ── Branches ─────────────────────────────────────────────────────────────
	{
		name: "gitlab_create_branch",
		description:
			"Create a new branch on GitLab for a task and link it to the task.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				repoId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked repository") +
						" Use gitlab_list_linked_repos to get the repo ID.",
				},
				branch_name: {
					type: "string",
					description:
						"The name for the new branch (e.g., 'feat/PROJ-42-add-feature').",
				},
				source_branch: {
					type: "string",
					description:
						"The source branch to branch from. Defaults to the repository's default branch (optional).",
				},
			},
			required: ["projectId", "taskId", "repoId", "branch_name"],
		},
	},
	{
		name: "gitlab_link_branch_to_task",
		description:
			"Link an existing GitLab branch to a task (does not create the branch on GitLab).",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
				repoId: {
					type: "string",
					description:
						UUID_DESC.replace("%s", "linked repository") +
						" Use gitlab_list_linked_repos to get the repo ID.",
				},
				branch_name: {
					type: "string",
					description:
						"The existing branch name (e.g., 'feature/my-branch').",
				},
			},
			required: ["projectId", "taskId", "repoId", "branch_name"],
		},
	},
	{
		name: "gitlab_list_task_branches",
		description: "List branches linked to a task.",
		inputSchema: {
			type: "object",
			properties: {
				projectId: projectIdProp,
				taskId: taskIdProp,
			},
			required: ["projectId", "taskId"],
		},
	},
];

// ── Entry ─────────────────────────────────────────────────────────────────────

const entry: PluginMCPEntry = {
	tools,

	async handleToolCall(
		name: string,
		args: Record<string, unknown>,
		context: PluginMCPContext,
	) {
		const api = new PluginAPIClient(context);

		try {
			switch (name) {
				// ── Integration ────────────────────────────────────────────────
				case "gitlab_get_integration": {
					const { projectId } = args as { projectId: string };
					const integration = await api.pluginGet<GitLabIntegration>(
						`projects/${projectId}/integration`,
					);
					return textResult(formatIntegration(integration));
				}

				case "gitlab_set_token": {
					const { projectId, token } = args as {
						projectId: string;
						token: string;
					};
					const integration = await api.pluginPost<GitLabIntegration>(
						`projects/${projectId}/integration/token`,
						{ token },
					);
					return textResult(
						`GitLab token set successfully:\n\n${formatIntegration(integration)}`,
					);
				}

				case "gitlab_delete_token": {
					const { projectId } = args as { projectId: string };
					await api.pluginDelete(`projects/${projectId}/integration/token`);
					return textResult("GitLab token deleted successfully.");
				}

				// ── Repositories ───────────────────────────────────────────────
				case "gitlab_list_linked_repos": {
					const { projectId } = args as { projectId: string };
					const repos = await api.pluginGet<LinkedRepository[]>(
						`projects/${projectId}/repositories`,
					);
					return textResult(
						`Linked GitLab Repositories:\n\n${formatList(repos, formatLinkedRepo)}`,
					);
				}

				case "gitlab_link_repository": {
					const { projectId, owner, repo_name } = args as {
						projectId: string;
						owner: string;
						repo_name: string;
					};
					const repo = await api.pluginPost<LinkedRepository>(
						`projects/${projectId}/repositories`,
						{ owner, repo_name },
					);
					return textResult(
						`Repository linked successfully:\n\n${formatLinkedRepo(repo)}`,
					);
				}

				case "gitlab_unlink_repository": {
					const { projectId, repoId } = args as {
						projectId: string;
						repoId: string;
					};
					await api.pluginDelete(
						`projects/${projectId}/repositories/${repoId}`,
					);
					return textResult(`Repository ${repoId} unlinked successfully.`);
				}

				// ── Merge Requests ──────────────────────────────────────────────
				case "gitlab_list_task_prs": {
					const { projectId, taskId } = args as {
						projectId: string;
						taskId: string;
					};
					const prs = await api.pluginGet<PullRequest[]>(
						`projects/${projectId}/tasks/${taskId}/pull-requests`,
					);
					return textResult(
						`Merge Requests:\n\n${formatList(prs, formatPullRequest)}`,
					);
				}

				case "gitlab_link_pr_to_task": {
					const { projectId, taskId, repoId, pr_number } = args as {
						projectId: string;
						taskId: string;
						repoId: string;
						pr_number: number;
					};
					const pr = await api.pluginPost<PullRequest>(
						`projects/${projectId}/tasks/${taskId}/pull-requests/link`,
						{ repo_id: repoId, pr_number },
					);
					return textResult(
						`Merge request linked successfully:\n\n${formatPullRequest(pr)}`,
					);
				}

				case "gitlab_unlink_pr_from_task": {
					const { projectId, taskId, prId } = args as {
						projectId: string;
						taskId: string;
						prId: string;
					};
					await api.pluginDelete(
						`projects/${projectId}/tasks/${taskId}/pull-requests/${prId}`,
					);
					return textResult(`Merge request ${prId} unlinked successfully.`);
				}

				case "gitlab_create_pull_request": {
					const { projectId, taskId, repoId, title, head_branch, base_branch, body } =
						args as {
							projectId: string;
							taskId: string;
							repoId: string;
							title: string;
							head_branch: string;
							base_branch: string;
							body?: string;
						};
					const pr = await api.pluginPost<CreatePullRequestResult>(
						`projects/${projectId}/tasks/${taskId}/pull-requests`,
						{ repo_id: repoId, title, head_branch, base_branch, body: body ?? "" },
					);
					return textResult(
						`Merge request created successfully:\n\n#${pr.pr_number} ${pr.title}\nState: ${pr.state}\nAuthor: ${pr.author}\nHead: ${pr.head_branch} → Base: ${pr.base_branch}\nURL: ${pr.html_url}`,
					);
				}

				case "gitlab_get_pull_request": {
					const { projectId, taskId, prId } = args as {
						projectId: string;
						taskId: string;
						prId: string;
					};
					const pr = await api.pluginGet<PullRequestDetails>(
						`projects/${projectId}/tasks/${taskId}/pull-requests/${prId}`,
					);
					return textResult(formatPullRequestDetails(pr));
				}

				case "gitlab_get_pull_request_ci_status": {
					const { projectId, taskId, prId } = args as {
						projectId: string;
						taskId: string;
						prId: string;
					};
					const ci = await api.pluginGet<PullRequestCIStatus>(
						`projects/${projectId}/tasks/${taskId}/pull-requests/${prId}/ci-status`,
					);
					return textResult(formatCIStatus(ci));
				}

				case "gitlab_comment_pull_request": {
					const { projectId, taskId, prId, body } = args as {
						projectId: string;
						taskId: string;
						prId: string;
						body: string;
					};
					await api.pluginPost(
						`projects/${projectId}/tasks/${taskId}/pull-requests/${prId}/comments`,
						{ body },
					);
					return textResult("Comment posted successfully.");
				}

				case "gitlab_review_pull_request": {
					const { projectId, taskId, prId, event, body } = args as {
						projectId: string;
						taskId: string;
						prId: string;
						event: string;
						body?: string;
					};
					await api.pluginPost(
						`projects/${projectId}/tasks/${taskId}/pull-requests/${prId}/reviews`,
						{ event, body: body ?? "" },
					);
					return textResult("Review submitted successfully.");
				}

				// ── Branches ───────────────────────────────────────────────────
				case "gitlab_create_branch": {
					const { projectId, taskId, repoId, branch_name, source_branch } =
						args as {
							projectId: string;
							taskId: string;
							repoId: string;
							branch_name: string;
							source_branch?: string;
						};
					const result = await api.pluginPost<CreateBranchResult>(
						`projects/${projectId}/tasks/${taskId}/branches`,
						{ repo_id: repoId, branch_name, source_branch },
					);
					return textResult(
						`Branch created successfully:\n\nBranch: ${result.branch_name}\nRepository: ${result.repo_full_name}\nURL: ${result.html_url}`,
					);
				}

				case "gitlab_link_branch_to_task": {
					const { projectId, taskId, repoId, branch_name } = args as {
						projectId: string;
						taskId: string;
						repoId: string;
						branch_name: string;
					};
					const branch = await api.pluginPost<TaskBranch>(
						`projects/${projectId}/tasks/${taskId}/branches/link`,
						{ repo_id: repoId, branch_name },
					);
					return textResult(
						`Branch linked successfully:\n\n${formatBranch(branch)}`,
					);
				}

				case "gitlab_list_task_branches": {
					const { projectId, taskId } = args as {
						projectId: string;
						taskId: string;
					};
					const branches = await api.pluginGet<TaskBranch[]>(
						`projects/${projectId}/tasks/${taskId}/branches`,
					);
					return textResult(
						`Branches:\n\n${formatList(branches, formatBranch)}`,
					);
				}

				default:
					return errorResult(`Unknown tool: ${name}`);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			return errorResult(`GitLab plugin error: ${msg}`);
		}
	},

	async getToolContext(
		toolId: string,
		args: Record<string, unknown>,
		context: PluginMCPContext,
	) {
		if (toolId !== "get_task") return null;
		const { projectId, taskId } = args as { projectId: string; taskId: string };

		const api = new PluginAPIClient(context);
		try {
			const [branches, prs] = await Promise.all([
				api.pluginGet<TaskBranch[]>(
					`projects/${projectId}/tasks/${taskId}/branches`,
				),
				api.pluginGet<PullRequest[]>(
					`projects/${projectId}/tasks/${taskId}/pull-requests`,
				),
			]);
			if (branches.length === 0 && prs.length === 0) return null;

			const lines = ["## GitLab"];
			if (branches.length > 0) {
				lines.push(
					"",
					"**Branches:**",
					...branches.map((b) => `- ${b.branch_name}`),
				);
			}
			if (prs.length > 0) {
				lines.push(
					"",
					"**Merge Requests:**",
					...prs.map(
						(pr) => `- #${pr.pr_number} [${pr.state}] ${pr.title} — ${pr.html_url}`,
					),
				);
			}
			return lines.join("\n");
		} catch {
			// Best-effort enrichment — a transient failure here should not
			// break the get_task response for the AI client.
			return null;
		}
	},
};

export default entry;

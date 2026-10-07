package main

import (
	"strings"
	"context"
	"errors"
	"fmt"

	plugin "github.com/Paca-AI/plugin-sdk-go"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type pullRequestResponse struct {
	ID         string  `json:"id"`
	ProjectID  string  `json:"project_id"`
	RepoID     string  `json:"repo_id"`
	PRNumber   int     `json:"pr_number"`
	GitLabMRID int64   `json:"gitlab_mr_id"`
	Title      string  `json:"title"`
	State      string  `json:"state"`
	HTMLURL    string  `json:"html_url"`
	HeadBranch string  `json:"head_branch"`
	BaseBranch string  `json:"base_branch"`
	Author     string  `json:"author"`
	MergedAt   *string `json:"merged_at"`
	CreatedAt  string  `json:"created_at"`
	UpdatedAt  string  `json:"updated_at"`
}

// ─── GET /tasks/:taskId/github/pull-requests ──────────────────────────────────

func (p *gitlabPlugin) listTaskPRs(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	if !p.taskBelongsToProject(taskID, projectID, res) {
		return
	}

	linkResult, err := p.db.Query(
		`SELECT merge_request_id FROM gitlab_task_mr_links WHERE task_id = $1 ORDER BY created_at ASC`,
		taskID,
	)
	if err != nil {
		apiError(res, 500, "INTERNAL_ERROR", err.Error())
		return
	}

	// No SQL JOIN here (resolved via a separate query per link instead) —
	// consistent with resolvePRForTask's style elsewhere in this plugin.
	// taskBelongsToProject above already closes the main vector (a foreign
	// taskId); re-verifying each linked PR's own project_id here is
	// defense-in-depth against any row a pre-fix caller might have already
	// linked across projects.
	items := make([]pullRequestResponse, 0, len(linkResult.Rows))
	for _, linkRow := range linkResult.Rows {
		prID := newRowScanner(linkResult.Columns, linkRow).str("merge_request_id")
		prResult, pErr := p.db.Query(
			`SELECT id, project_id, repo_id, pr_number, gitlab_mr_id, title, state, html_url, head_branch, base_branch, author, merged_at, created_at, updated_at FROM gitlab_merge_requests WHERE id = $1 AND project_id = $2`,
			prID, projectID,
		)
		if pErr != nil {
			apiError(res, 500, "INTERNAL_ERROR", pErr.Error())
			return
		}
		if len(prResult.Rows) == 0 {
			continue
		}
		sc := newRowScanner(prResult.Columns, prResult.Rows[0])
		items = append(items, pullRequestResponse{
			ID:         sc.str("id"),
			ProjectID:  sc.str("project_id"),
			RepoID:     sc.str("repo_id"),
			PRNumber:   sc.intVal("pr_number"),
			GitLabMRID: sc.int64Val("gitlab_mr_id"),
			Title:      sc.str("title"),
			State:      sc.str("state"),
			HTMLURL:    sc.str("html_url"),
			HeadBranch: sc.str("head_branch"),
			BaseBranch: sc.str("base_branch"),
			Author:     sc.str("author"),
			MergedAt:   sc.strPtr("merged_at"),
			CreatedAt:  sc.str("created_at"),
			UpdatedAt:  sc.str("updated_at"),
		})
	}
	ok(res, items)
}

// ─── POST /tasks/:taskId/github/pull-requests/link ───────────────────────────

func (p *gitlabPlugin) linkPRToTask(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	if !p.taskBelongsToProject(taskID, projectID, res) {
		return
	}

	type linkPRToTaskBody struct {
		RepoID   string `json:"repo_id"`
		PRNumber int    `json:"pr_number"`
	}
	b, err := plugin.JSONBody[linkPRToTaskBody](req)
	if err != nil || b.RepoID == "" || b.PRNumber == 0 {
		apiError(res, 400, "BAD_REQUEST", "repo_id and pr_number are required")
		return
	}

	ghc, err := p.clientForProject(projectID)
	if err != nil {
		writeAppError(res, err)
		return
	}

	// Get repository details.
	repoResult, rErr := p.db.Query(
		`SELECT owner, repo_name FROM gitlab_repositories WHERE id = $1 AND project_id = $2`,
		b.RepoID, projectID,
	)
	if rErr != nil {
		apiError(res, 500, "INTERNAL_ERROR", rErr.Error())
		return
	}
	if len(repoResult.Rows) == 0 {
		apiError(res, 404, "GITLAB_REPOSITORY_NOT_FOUND", "Repository not found")
		return
	}
	rSc := newRowScanner(repoResult.Columns, repoResult.Rows[0])
	owner := rSc.str("owner")
	repoName := rSc.str("repo_name")

	ghPR, err := ghc.getPullRequest(context.Background(), owner, repoName, b.PRNumber)
	if err != nil {
		var apiErr *glAPIError
		if errors.As(err, &apiErr) {
			switch apiErr.StatusCode {
			case 404:
				apiError(res, 404, "GITLAB_PR_NOT_FOUND", fmt.Sprintf("PR #%d not found in %s/%s", b.PRNumber, owner, repoName))
				return
			case 401, 403:
				apiError(res, 403, "GITLAB_TOKEN_INSUFFICIENT_PERMISSIONS", "Token does not have permission to read pull requests")
				return
			}
		}
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to fetch pull request: %s", err))
		return
	}

	state := ghPR.NormalizedState()

	now := nowStr()

	var mergedAtStr *string
	if ghPR.MergedAt != nil {
		s := ghPR.MergedAt.UTC().Format("2006-01-02T15:04:05.999999999Z")
		mergedAtStr = &s
	}

	// Upsert the PR cache; let PostgreSQL generate id on insert, RETURNING gives us id+created_at.
	upserted, err := p.db.Query(`
		INSERT INTO gitlab_merge_requests
			(project_id, repo_id, pr_number, gitlab_mr_id, title, state, html_url, head_branch, base_branch, author, merged_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT (repo_id, pr_number) DO UPDATE SET
			title=$5, state=$6, html_url=$7, head_branch=$8, base_branch=$9,
			author=$10, merged_at=$11, updated_at=$13
		RETURNING id, created_at
	`, projectID, b.RepoID, b.PRNumber, ghPR.ID, ghPR.Title, state,
		ghPR.WebURL, ghPR.SourceBranch, ghPR.TargetBranch, ghPR.Author.Username, mergedAtStr, now, now)
	if err != nil || len(upserted.Rows) == 0 {
		if err != nil {
			apiError(res, 500, "INTERNAL_ERROR", err.Error())
		} else {
			apiError(res, 500, "INTERNAL_ERROR", "upsert returned no rows")
		}
		return
	}
	prSc := newRowScanner(upserted.Columns, upserted.Rows[0])
	prID := prSc.str("id")
	prCreatedAt := prSc.str("created_at")

	// Link the PR to the task.
	rowsAffected, lErr := p.db.Exec(`
		INSERT INTO gitlab_task_mr_links (task_id, merge_request_id, created_at)
		VALUES ($1,$2,$3)
		ON CONFLICT (task_id, merge_request_id) DO NOTHING
	`, taskID, prID, now)
	if lErr != nil {
		apiError(res, 500, "INTERNAL_ERROR", lErr.Error())
		return
	}
	if rowsAffected == 0 {
		apiError(res, 409, "GITLAB_PR_ALREADY_LINKED", "Pull request is already linked to this task")
		return
	}

	plugin.EmitEvent("gitlab.mr_linked", map[string]any{
		"project_id": projectID,
		"task_id":    taskID,
		"repo_id":    b.RepoID,
		"pr_number":  b.PRNumber,
	})

	// Return the PR details.
	ok(res, pullRequestResponse{
		ID:         prID,
		ProjectID:  projectID,
		RepoID:     b.RepoID,
		PRNumber:   b.PRNumber,
		GitLabMRID: ghPR.ID,
		Title:      ghPR.Title,
		State:      state,
		HTMLURL:    ghPR.WebURL,
		HeadBranch: ghPR.SourceBranch,
		BaseBranch: ghPR.TargetBranch,
		Author:     ghPR.Author.Username,
		MergedAt:   mergedAtStr,
		CreatedAt:  prCreatedAt,
		UpdatedAt:  now,
	})
}

// ─── POST /tasks/:taskId/github/pull-requests ─────────────────────────────────

func (p *gitlabPlugin) createPullRequest(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	if !p.taskBelongsToProject(taskID, projectID, res) {
		return
	}

	type createPullRequestBody struct {
		RepoID     string `json:"repo_id"`
		Title      string `json:"title"`
		HeadBranch string `json:"head_branch"`
		BaseBranch string `json:"base_branch"`
		Body       string `json:"body"`
	}
	b, err := plugin.JSONBody[createPullRequestBody](req)
	if err != nil || b.RepoID == "" || b.Title == "" || b.HeadBranch == "" || b.BaseBranch == "" {
		apiError(res, 400, "BAD_REQUEST", "repo_id, title, head_branch, and base_branch are required")
		return
	}

	ghc, err := p.clientForProject(projectID)
	if err != nil {
		writeAppError(res, err)
		return
	}

	repoResult, rErr := p.db.Query(
		`SELECT owner, repo_name FROM gitlab_repositories WHERE id = $1 AND project_id = $2`,
		b.RepoID, projectID,
	)
	if rErr != nil {
		apiError(res, 500, "INTERNAL_ERROR", rErr.Error())
		return
	}
	if len(repoResult.Rows) == 0 {
		apiError(res, 404, "GITLAB_REPOSITORY_NOT_FOUND", "Repository not found")
		return
	}
	rSc := newRowScanner(repoResult.Columns, repoResult.Rows[0])
	owner := rSc.str("owner")
	repoName := rSc.str("repo_name")

	ghPR, err := ghc.createPullRequest(context.Background(), owner, repoName, b.Title, b.HeadBranch, b.BaseBranch, b.Body)
	if err != nil {
		var apiErr *glAPIError
		if errors.As(err, &apiErr) {
			switch apiErr.StatusCode {
			case 401, 403:
				apiError(res, 403, "GITLAB_TOKEN_INSUFFICIENT_PERMISSIONS", "Token does not have permission to create pull requests")
				return
			case 422:
				apiError(res, 422, "GITLAB_PR_VALIDATION_ERROR", fmt.Sprintf("GitLab validation error: %s", apiErr.Message))
				return
			}
		}
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to create pull request: %s", err))
		return
	}

	state := ghPR.NormalizedState()

	now := nowStr()

	var mergedAtStr *string
	if ghPR.MergedAt != nil {
		s := ghPR.MergedAt.UTC().Format("2006-01-02T15:04:05.999999999Z")
		mergedAtStr = &s
	}

	upserted, err := p.db.Query(`
		INSERT INTO gitlab_merge_requests
			(project_id, repo_id, pr_number, gitlab_mr_id, title, state, html_url, head_branch, base_branch, author, merged_at, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
		ON CONFLICT (repo_id, pr_number) DO UPDATE SET
			title=$5, state=$6, html_url=$7, head_branch=$8, base_branch=$9,
			author=$10, merged_at=$11, updated_at=$12
		RETURNING id
	`, projectID, b.RepoID, ghPR.IID, ghPR.ID, ghPR.Title, state,
		ghPR.WebURL, ghPR.SourceBranch, ghPR.TargetBranch, ghPR.Author.Username, mergedAtStr, now)
	if err != nil || len(upserted.Rows) == 0 {
		if err != nil {
			apiError(res, 500, "INTERNAL_ERROR", err.Error())
		} else {
			apiError(res, 500, "INTERNAL_ERROR", "upsert returned no rows")
		}
		return
	}
	prID := newRowScanner(upserted.Columns, upserted.Rows[0]).str("id")

	_, lErr := p.db.Exec(`
		INSERT INTO gitlab_task_mr_links (task_id, merge_request_id, created_at)
		VALUES ($1,$2,$3)
		ON CONFLICT (task_id, merge_request_id) DO NOTHING
	`, taskID, prID, now)
	if lErr != nil {
		p.log.Error("failed to link PR to task: " + lErr.Error())
	}

	plugin.EmitEvent("github.pr_created", map[string]any{
		"project_id": projectID,
		"task_id":    taskID,
		"repo_id":    b.RepoID,
		"pr_number":  ghPR.IID,
		"pr_url":     ghPR.WebURL,
	})

	created(res, pullRequestResponse{
		ID:         prID,
		ProjectID:  projectID,
		RepoID:     b.RepoID,
		PRNumber:   ghPR.IID,
		GitLabMRID: ghPR.ID,
		Title:      ghPR.Title,
		State:      state,
		HTMLURL:    ghPR.WebURL,
		HeadBranch: ghPR.SourceBranch,
		BaseBranch: ghPR.TargetBranch,
		Author:     ghPR.Author.Username,
		MergedAt:   mergedAtStr,
		CreatedAt:  now,
		UpdatedAt:  now,
	})
}

// ─── DELETE /tasks/:taskId/github/pull-requests/:prId ────────────────────────

func (p *gitlabPlugin) unlinkPRFromTask(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	prID := req.PathParam("prId")
	if !p.taskBelongsToProject(taskID, projectID, res) {
		return
	}

	// Re-verify the PR itself belongs to the caller's project (not just the
	// task) before deleting the link — defense-in-depth against any link a
	// pre-fix caller might have already created across projects.
	prResult, err := p.db.Query(
		`SELECT id FROM gitlab_merge_requests WHERE id = $1 AND project_id = $2`,
		prID, projectID,
	)
	if err != nil {
		apiError(res, 500, "INTERNAL_ERROR", err.Error())
		return
	}
	if len(prResult.Rows) == 0 {
		apiError(res, 404, "GITLAB_PR_LINK_NOT_FOUND", "Pull request link not found")
		return
	}

	rowsAffected, err := p.db.Exec(
		`DELETE FROM gitlab_task_mr_links WHERE task_id = $1 AND merge_request_id = $2`,
		taskID, prID,
	)
	if err != nil {
		apiError(res, 500, "INTERNAL_ERROR", err.Error())
		return
	}
	if rowsAffected == 0 {
		apiError(res, 404, "GITLAB_PR_LINK_NOT_FOUND", "Pull request link not found")
		return
	}
	noContent(res)
}

// ─── Shared: resolve a PR's GitLab coordinates for a task ────────────────────

// resolvePRForTask looks up the owner/repo/PR-number GitLab needs to act on a
// PR, verifying in the same query that prID is actually linked to taskID
// within this project. Used by every handler below so a caller can't act on
// a PR outside the task (or project) it claims to be operating in.
func (p *gitlabPlugin) resolvePRForTask(projectID, taskID, prID string) (owner, repoName string, prNumber int, err error) {
	linkResult, lErr := p.db.Query(
		`SELECT merge_request_id FROM gitlab_task_mr_links WHERE task_id = $1 AND merge_request_id = $2`,
		taskID, prID,
	)
	if lErr != nil {
		return "", "", 0, lErr
	}
	if len(linkResult.Rows) == 0 {
		return "", "", 0, &appError{code: "GITLAB_PR_LINK_NOT_FOUND", status: 404, msg: "Pull request link not found"}
	}

	prResult, pErr := p.db.Query(
		`SELECT repo_id, pr_number FROM gitlab_merge_requests WHERE id = $1 AND project_id = $2`,
		prID, projectID,
	)
	if pErr != nil {
		return "", "", 0, pErr
	}
	if len(prResult.Rows) == 0 {
		return "", "", 0, &appError{code: "GITLAB_PR_NOT_FOUND", status: 404, msg: "Pull request not found"}
	}
	prSc := newRowScanner(prResult.Columns, prResult.Rows[0])
	repoID := prSc.str("repo_id")
	prNumber = prSc.intVal("pr_number")

	repoResult, rErr := p.db.Query(
		`SELECT owner, repo_name FROM gitlab_repositories WHERE id = $1 AND project_id = $2`,
		repoID, projectID,
	)
	if rErr != nil {
		return "", "", 0, rErr
	}
	if len(repoResult.Rows) == 0 {
		return "", "", 0, &appError{code: "GITLAB_REPOSITORY_NOT_FOUND", status: 404, msg: "Repository not found"}
	}
	repoSc := newRowScanner(repoResult.Columns, repoResult.Rows[0])
	return repoSc.str("owner"), repoSc.str("repo_name"), prNumber, nil
}

// ─── GET /tasks/:taskId/github/pull-requests/:prId ────────────────────────────

type pullRequestDetailsResponse struct {
	Owner    string `json:"owner"`
	RepoName string `json:"repo_name"`
	PRNumber int    `json:"pr_number"`
	Title    string `json:"title"`
	State    string `json:"state"`
	Body     string `json:"body"`
	HTMLURL  string `json:"html_url"`
	Diff     string `json:"diff"`
}

func (p *gitlabPlugin) getPullRequestDetails(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	prID := req.PathParam("prId")

	owner, repoName, prNumber, err := p.resolvePRForTask(projectID, taskID, prID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	ghc, err := p.clientForProject(projectID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	ctx := context.Background()
	ghPR, err := ghc.getPullRequest(ctx, owner, repoName, prNumber)
	if err != nil {
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to fetch pull request: %s", err))
		return
	}
	diff, err := ghc.getPullRequestDiff(ctx, owner, repoName, prNumber)
	if err != nil {
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to fetch pull request diff: %s", err))
		return
	}

	ok(res, pullRequestDetailsResponse{
		Owner:    owner,
		RepoName: repoName,
		PRNumber: prNumber,
		Title:    ghPR.Title,
		State:    ghPR.NormalizedState(),
		HTMLURL:  ghPR.WebURL,
		Diff:     diff,
	})
}

// ─── GET /tasks/:taskId/github/pull-requests/:prId/ci-status ─────────────────

type ciCheckResponse struct {
	Name       string `json:"name"`
	Status     string `json:"status"`     // "queued" | "in_progress" | "completed" | "pending"
	Conclusion string `json:"conclusion"` // "success" | "failure" | ... | "" while not completed
	URL        string `json:"url"`
}

type ciStatusResponse struct {
	State  string            `json:"state"` // "success" | "failure" | "pending" | "unknown"
	Checks []ciCheckResponse `json:"checks"`
}

// overallCIState summarizes a set of checks the same way GitLab's own PR
// merge-box does: any failure wins, otherwise any still-running check makes
// the whole thing pending, otherwise (and only if there's at least one
// check) it's a success. No checks at all is reported as "unknown" rather
// than "success" so the agent doesn't mistake "no CI configured" for "CI
// passed".
func overallCIState(checks []ciCheckResponse) string {
	if len(checks) == 0 {
		return "unknown"
	}
	pending := false
	for _, c := range checks {
		switch c.Conclusion {
		case "failure", "timed_out", "cancelled", "action_required", "error":
			return "failure"
		case "success", "neutral", "skipped":
			continue
		}
		if c.Status != "completed" {
			pending = true
		}
	}
	if pending {
		return "pending"
	}
	return "success"
}

func (p *gitlabPlugin) getPullRequestCIStatus(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	prID := req.PathParam("prId")

	owner, repoName, prNumber, err := p.resolvePRForTask(projectID, taskID, prID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	ghc, err := p.clientForProject(projectID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	ctx := context.Background()
	if _, err := ghc.getPullRequest(ctx, owner, repoName, prNumber); err != nil {
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to fetch merge request: %s", err))
		return
	}
	pipelines, pErr := ghc.listMergeRequestPipelines(ctx, owner, repoName, prNumber)
	if pErr != nil {
		p.log.Error(fmt.Sprintf("failed to fetch MR pipelines for %s/%s!%d: %s", owner, repoName, prNumber, pErr))
		ok(res, ciStatusResponse{State: "unknown", Checks: []ciCheckResponse{}})
		return
	}

	checks := make([]ciCheckResponse, 0, len(pipelines))
	for _, pipe := range pipelines {
		status, conclusion := mapPipelineStatus(pipe.Status)
		name := pipe.Name
		if name == "" {
			name = "pipeline #" + fmt.Sprintf("%d", pipe.ID)
		}
		checks = append(checks, ciCheckResponse{
			Name:       name,
			Status:     status,
			Conclusion: conclusion,
			URL:        pipe.WebURL,
		})
	}

	ok(res, ciStatusResponse{
		State:  overallCIState(checks),
		Checks: checks,
	})
}

func mapPipelineStatus(status string) (runStatus, conclusion string) {
	switch strings.ToLower(status) {
	case "success":
		return "completed", "success"
	case "failed":
		return "completed", "failure"
	case "canceled", "cancelled":
		return "completed", "cancelled"
	case "skipped":
		return "completed", "skipped"
	case "manual", "scheduled":
		return "completed", "action_required"
	case "running", "pending", "created", "waiting_for_resource", "preparing":
		return "in_progress", ""
	default:
		return status, ""
	}
}

// ─── POST /tasks/:taskId/github/pull-requests/:prId/comments ─────────────────

func (p *gitlabPlugin) addPullRequestComment(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	prID := req.PathParam("prId")

	type addPullRequestCommentBody struct {
		Body string `json:"body"`
	}
	b, err := plugin.JSONBody[addPullRequestCommentBody](req)
	if err != nil || b.Body == "" {
		apiError(res, 400, "BAD_REQUEST", "body is required")
		return
	}

	owner, repoName, prNumber, err := p.resolvePRForTask(projectID, taskID, prID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	ghc, err := p.clientForProject(projectID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	if err := ghc.createIssueComment(context.Background(), owner, repoName, prNumber, b.Body); err != nil {
		var apiErr *glAPIError
		if errors.As(err, &apiErr) && (apiErr.StatusCode == 401 || apiErr.StatusCode == 403) {
			apiError(res, 403, "GITLAB_TOKEN_INSUFFICIENT_PERMISSIONS", "Token does not have permission to comment on pull requests")
			return
		}
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to add comment: %s", err))
		return
	}
	created(res, map[string]bool{"success": true})
}

// ─── POST /tasks/:taskId/github/pull-requests/:prId/reviews ──────────────────

func (p *gitlabPlugin) createReview(req *plugin.Request, res *plugin.Response) {
	projectID := req.Caller.ProjectID
	taskID := req.PathParam("taskId")
	prID := req.PathParam("prId")

	type createReviewBody struct {
		Event string `json:"event"`
		Body  string `json:"body"`
	}
	b, err := plugin.JSONBody[createReviewBody](req)
	if err != nil {
		apiError(res, 400, "BAD_REQUEST", "event is required")
		return
	}
	switch b.Event {
	case "APPROVE", "REQUEST_CHANGES", "COMMENT":
	default:
		apiError(res, 400, "BAD_REQUEST", "event must be one of: APPROVE, REQUEST_CHANGES, COMMENT")
		return
	}

	owner, repoName, prNumber, err := p.resolvePRForTask(projectID, taskID, prID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	ghc, err := p.clientForProject(projectID)
	if err != nil {
		writeAppError(res, err)
		return
	}
	if err := ghc.createPullRequestReview(context.Background(), owner, repoName, prNumber, b.Event, b.Body); err != nil {
		var apiErr *glAPIError
		if errors.As(err, &apiErr) {
			switch apiErr.StatusCode {
			case 401, 403:
				apiError(res, 403, "GITLAB_TOKEN_INSUFFICIENT_PERMISSIONS", "Token does not have permission to review pull requests")
				return
			case 422:
				apiError(res, 422, "GITLAB_PR_VALIDATION_ERROR", fmt.Sprintf("GitLab validation error: %s", apiErr.Message))
				return
			}
		}
		apiError(res, 502, "INTERNAL_ERROR", fmt.Sprintf("failed to submit review: %s", err))
		return
	}
	created(res, map[string]bool{"success": true})
}

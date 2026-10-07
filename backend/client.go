package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	plugin "github.com/Paca-AI/plugin-sdk-go"
)

const defaultGitLabInstance = "https://gitlab.com"

// glProject is a GitLab project (repository) representation.
type glProject struct {
	ID                int64  `json:"id"`
	Name              string `json:"name"`
	Path              string `json:"path"`
	PathWithNamespace string `json:"path_with_namespace"`
	DefaultBranch     string `json:"default_branch"`
	Visibility        string `json:"visibility"`
	WebURL            string `json:"web_url"`
	HTTPURLToRepo     string `json:"http_url_to_repo"`
	Namespace         struct {
		FullPath string `json:"full_path"`
		Path     string `json:"path"`
	} `json:"namespace"`
}

func (p glProject) Private() bool {
	return p.Visibility == "private" || p.Visibility == "internal"
}

func (p glProject) Owner() string {
	if p.Namespace.FullPath != "" {
		return p.Namespace.FullPath
	}
	parts := strings.Split(p.PathWithNamespace, "/")
	if len(parts) < 2 {
		return ""
	}
	return strings.Join(parts[:len(parts)-1], "/")
}

// glMergeRequest is a GitLab merge request. Number maps to project-scoped iid.
type glMergeRequest struct {
	ID           int64  `json:"id"`
	IID          int    `json:"iid"`
	Title        string `json:"title"`
	State        string `json:"state"` // opened | closed | merged | locked
	WebURL       string `json:"web_url"`
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch"`
	Author       struct {
		Username string `json:"username"`
	} `json:"author"`
	MergedAt    *time.Time `json:"merged_at"`
	Description string     `json:"description"`
	SHA         string     `json:"sha"`
}

// Number returns the project-scoped iid (GitLab UI number).
func (m glMergeRequest) Number() int { return m.IID }

func (m glMergeRequest) NormalizedState() string {
	switch strings.ToLower(m.State) {
	case "opened", "open", "locked":
		return "open"
	case "merged":
		return "merged"
	case "closed":
		return "closed"
	default:
		return strings.ToLower(m.State)
	}
}

// glPipeline is a minimal pipeline summary for CI status.
type glPipeline struct {
	ID     int64  `json:"id"`
	Status string `json:"status"`
	WebURL string `json:"web_url"`
	Name   string `json:"name"`
	Ref    string `json:"ref"`
	SHA    string `json:"sha"`
}

type glAPIError struct {
	StatusCode int
	Message    string
	Details    string
}

func (e *glAPIError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("gitlab: API error %d: %s (%s)", e.StatusCode, e.Message, e.Details)
	}
	return fmt.Sprintf("gitlab: API error %d: %s", e.StatusCode, e.Message)
}

// glClient talks to a GitLab REST API v4 instance with a Personal, Project, or
// Group Access Token (all use the same PRIVATE-TOKEN / Bearer auth).
type glClient struct {
	token    string
	baseURL  string // e.g. https://gitlab.com/api/v4
	hostURL  string // e.g. https://gitlab.com
}

func normalizeInstanceURL(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return defaultGitLabInstance
	}
	if !strings.HasPrefix(s, "http://") && !strings.HasPrefix(s, "https://") {
		s = "https://" + s
	}
	return strings.TrimRight(s, "/")
}

func newGLClient(token, instanceURL string) *glClient {
	host := normalizeInstanceURL(instanceURL)
	return &glClient{
		token:   token,
		hostURL: host,
		baseURL: host + "/api/v4",
	}
}

func (c *glClient) headers() map[string]string {
	return map[string]string{
		"PRIVATE-TOKEN": c.token,
		"Accept":        "application/json",
	}
}

func (c *glClient) projectPath(owner, repo string) string {
	full := strings.Trim(owner, "/") + "/" + strings.Trim(repo, "/")
	return url.PathEscape(full) // encodes slash as %2F — required by GitLab
}

func (c *glClient) get(_ context.Context, rawURL string, out any) error {
	resp, err := plugin.Fetch("GET", rawURL, c.headers(), "")
	if err != nil {
		return fmt.Errorf("gitlabclient: execute request: %w", err)
	}
	if resp.Status >= 400 {
		return glParseAPIError(resp.Status, resp.Body)
	}
	if out != nil {
		if err := json.Unmarshal([]byte(resp.Body), out); err != nil {
			return fmt.Errorf("gitlabclient: decode response: %w", err)
		}
	}
	return nil
}

func (c *glClient) post(_ context.Context, rawURL string, body, out any) error {
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("gitlabclient: encode body: %w", err)
	}
	hdrs := c.headers()
	hdrs["Content-Type"] = "application/json"
	resp, err := plugin.Fetch("POST", rawURL, hdrs, string(bodyJSON))
	if err != nil {
		return fmt.Errorf("gitlabclient: execute request: %w", err)
	}
	if resp.Status >= 400 {
		return glParseAPIError(resp.Status, resp.Body)
	}
	if out != nil && strings.TrimSpace(resp.Body) != "" {
		if err := json.Unmarshal([]byte(resp.Body), out); err != nil {
			return fmt.Errorf("gitlabclient: decode response: %w", err)
		}
	}
	return nil
}

func (c *glClient) put(_ context.Context, rawURL string, body, out any) error {
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("gitlabclient: encode body: %w", err)
	}
	hdrs := c.headers()
	hdrs["Content-Type"] = "application/json"
	resp, err := plugin.Fetch("PUT", rawURL, hdrs, string(bodyJSON))
	if err != nil {
		return fmt.Errorf("gitlabclient: execute request: %w", err)
	}
	if resp.Status >= 400 {
		return glParseAPIError(resp.Status, resp.Body)
	}
	if out != nil && strings.TrimSpace(resp.Body) != "" {
		if err := json.Unmarshal([]byte(resp.Body), out); err != nil {
			return fmt.Errorf("gitlabclient: decode response: %w", err)
		}
	}
	return nil
}

func (c *glClient) doDelete(_ context.Context, rawURL string) error {
	resp, err := plugin.Fetch("DELETE", rawURL, c.headers(), "")
	if err != nil {
		return fmt.Errorf("gitlabclient: execute request: %w", err)
	}
	if resp.Status == 404 || resp.Status == 204 {
		return nil
	}
	if resp.Status >= 400 {
		return glParseAPIError(resp.Status, resp.Body)
	}
	return nil
}

func glParseAPIError(statusCode int, body string) error {
	var errBody struct {
		Message          any      `json:"message"`
		Error            string   `json:"error"`
		ErrorDescription string   `json:"error_description"`
	}
	_ = json.Unmarshal([]byte(body), &errBody)
	msg := errBody.Error
	if msg == "" {
		switch v := errBody.Message.(type) {
		case string:
			msg = v
		case map[string]any:
			b, _ := json.Marshal(v)
			msg = string(b)
		default:
			if errBody.ErrorDescription != "" {
				msg = errBody.ErrorDescription
			}
		}
	}
	if msg == "" {
		msg = fmt.Sprintf("HTTP %d", statusCode)
	}
	return &glAPIError{StatusCode: statusCode, Message: msg}
}

// ─── API methods ─────────────────────────────────────────────────────────────

func (c *glClient) validateToken(ctx context.Context) error {
	var user struct {
		ID       int64  `json:"id"`
		Username string `json:"username"`
	}
	return c.get(ctx, c.baseURL+"/user", &user)
}

func (c *glClient) listRepositories(ctx context.Context) ([]glProject, error) {
	seen := make(map[int64]struct{})
	var all []glProject
	for page := 1; ; page++ {
		u := fmt.Sprintf("%s/projects?membership=true&simple=false&per_page=100&page=%d&order_by=updated_at&sort=desc", c.baseURL, page)
		var batch []glProject
		if err := c.get(ctx, u, &batch); err != nil {
			return nil, err
		}
		for _, p := range batch {
			if _, ok := seen[p.ID]; ok {
				continue
			}
			seen[p.ID] = struct{}{}
			all = append(all, p)
		}
		if len(batch) < 100 {
			break
		}
	}
	return all, nil
}

func (c *glClient) getRepository(ctx context.Context, owner, repo string) (*glProject, error) {
	u := fmt.Sprintf("%s/projects/%s", c.baseURL, c.projectPath(owner, repo))
	var p glProject
	if err := c.get(ctx, u, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// generateSigningToken creates a Standard Webhooks-style signing token
// (whsec_ + base64 of 32 random bytes) for GitLab 19+ project hooks.
func generateSigningToken() (string, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", err
	}
	return "whsec_" + base64.StdEncoding.EncodeToString(key), nil
}

func (c *glClient) createWebhook(ctx context.Context, owner, repo, webhookURL, signingToken string) (int64, error) {
	u := fmt.Sprintf("%s/projects/%s/hooks", c.baseURL, c.projectPath(owner, repo))
	body := map[string]any{
		"url":                    webhookURL,
		"push_events":            true,
		"merge_requests_events":  true,
		"pipeline_events":        true,
		"enable_ssl_verification": true,
		"signing_token":          signingToken,
	}
	var resp struct {
		ID int64 `json:"id"`
	}
	if err := c.post(ctx, u, body, &resp); err != nil {
		return 0, err
	}
	return resp.ID, nil
}

func (c *glClient) deleteWebhook(ctx context.Context, owner, repo string, hookID int64) error {
	u := fmt.Sprintf("%s/projects/%s/hooks/%d", c.baseURL, c.projectPath(owner, repo), hookID)
	return c.doDelete(ctx, u)
}

func (c *glClient) getPullRequest(ctx context.Context, owner, repo string, mrIID int) (*glMergeRequest, error) {
	u := fmt.Sprintf("%s/projects/%s/merge_requests/%d", c.baseURL, c.projectPath(owner, repo), mrIID)
	var mr glMergeRequest
	if err := c.get(ctx, u, &mr); err != nil {
		return nil, err
	}
	return &mr, nil
}

func (c *glClient) createPullRequest(ctx context.Context, owner, repo, title, sourceBranch, targetBranch, body string) (*glMergeRequest, error) {
	u := fmt.Sprintf("%s/projects/%s/merge_requests", c.baseURL, c.projectPath(owner, repo))
	reqBody := map[string]any{
		"title":          title,
		"source_branch":  sourceBranch,
		"target_branch":  targetBranch,
	}
	if body != "" {
		reqBody["description"] = body
	}
	var mr glMergeRequest
	if err := c.post(ctx, u, reqBody, &mr); err != nil {
		return nil, err
	}
	return &mr, nil
}

func (c *glClient) mergePullRequest(ctx context.Context, owner, repo string, mrIID int, mergeMethod string) error {
	u := fmt.Sprintf("%s/projects/%s/merge_requests/%d/merge", c.baseURL, c.projectPath(owner, repo), mrIID)
	body := map[string]any{}
	switch mergeMethod {
	case "squash":
		body["squash"] = true
	case "rebase":
		// GitLab merges after rebase when merge_when_pipeline_succeeds / FF settings allow;
		// request squash=false and rely on project merge method when possible.
		body["squash"] = false
	default:
		body["squash"] = false
	}
	return c.put(ctx, u, body, nil)
}

func (c *glClient) getPullRequestDiff(ctx context.Context, owner, repo string, mrIID int) (string, error) {
	u := fmt.Sprintf("%s/projects/%s/merge_requests/%d/changes", c.baseURL, c.projectPath(owner, repo), mrIID)
	var resp struct {
		Changes []struct {
			OldPath string `json:"old_path"`
			NewPath string `json:"new_path"`
			Diff    string `json:"diff"`
		} `json:"changes"`
	}
	if err := c.get(ctx, u, &resp); err != nil {
		return "", err
	}
	var b strings.Builder
	for _, ch := range resp.Changes {
		fmt.Fprintf(&b, "--- a/%s\n+++ b/%s\n%s\n", ch.OldPath, ch.NewPath, ch.Diff)
	}
	return b.String(), nil
}

// createPullRequestReview maps GitHub-style review events onto GitLab:
// COMMENT → MR note; APPROVE → approvals API; REQUEST_CHANGES → blocking-style note + unapprove.
func (c *glClient) createPullRequestReview(ctx context.Context, owner, repo string, mrIID int, event, body string) error {
	switch strings.ToUpper(event) {
	case "APPROVE":
		if body != "" {
			_ = c.createIssueComment(ctx, owner, repo, mrIID, body)
		}
		u := fmt.Sprintf("%s/projects/%s/merge_requests/%d/approve", c.baseURL, c.projectPath(owner, repo), mrIID)
		return c.post(ctx, u, map[string]any{}, nil)
	case "REQUEST_CHANGES":
		note := body
		if note == "" {
			note = "Changes requested."
		} else {
			note = "**Changes requested**\n\n" + note
		}
		if err := c.createIssueComment(ctx, owner, repo, mrIID, note); err != nil {
			return err
		}
		// Best-effort: remove prior approval so the MR is no longer approved.
		u := fmt.Sprintf("%s/projects/%s/merge_requests/%d/unapprove", c.baseURL, c.projectPath(owner, repo), mrIID)
		_ = c.post(ctx, u, map[string]any{}, nil)
		return nil
	case "COMMENT":
		return c.createIssueComment(ctx, owner, repo, mrIID, body)
	default:
		return fmt.Errorf("gitlabclient: unsupported review event %q", event)
	}
}

func (c *glClient) createIssueComment(ctx context.Context, owner, repo string, mrIID int, body string) error {
	u := fmt.Sprintf("%s/projects/%s/merge_requests/%d/notes", c.baseURL, c.projectPath(owner, repo), mrIID)
	return c.post(ctx, u, map[string]string{"body": body}, nil)
}

func (c *glClient) listMergeRequestPipelines(ctx context.Context, owner, repo string, mrIID int) ([]glPipeline, error) {
	u := fmt.Sprintf("%s/projects/%s/merge_requests/%d/pipelines", c.baseURL, c.projectPath(owner, repo), mrIID)
	var pipelines []glPipeline
	if err := c.get(ctx, u, &pipelines); err != nil {
		return nil, err
	}
	return pipelines, nil
}

func (c *glClient) branchExists(ctx context.Context, owner, repo, branch string) error {
	u := fmt.Sprintf("%s/projects/%s/repository/branches/%s",
		c.baseURL, c.projectPath(owner, repo), url.PathEscape(branch))
	return c.get(ctx, u, &struct{}{})
}

func (c *glClient) createBranch(ctx context.Context, owner, repo, newBranch, sourceBranch string) error {
	u := fmt.Sprintf("%s/projects/%s/repository/branches", c.baseURL, c.projectPath(owner, repo))
	return c.post(ctx, u, map[string]string{
		"branch": newBranch,
		"ref":    sourceBranch,
	}, nil)
}

func (c *glClient) cloneURL(pathWithNamespace string) string {
	return c.hostURL + "/" + strings.Trim(pathWithNamespace, "/") + ".git"
}

// Compatibility aliases used by handlers still naming GitHub types in local vars.
type ghPullRequest = glMergeRequest
type ghRepository struct {
	ID            int64
	FullName      string
	Name          string
	DefaultBranch string
	Private       bool
	Owner         struct{ Login string }
	HTTPURLToRepo string
}

func glProjectToGHCompat(p *glProject) *ghRepository {
	if p == nil {
		return nil
	}
	r := &ghRepository{
		ID:            p.ID,
		FullName:      p.PathWithNamespace,
		Name:          p.Path,
		DefaultBranch: p.DefaultBranch,
		Private:       p.Private(),
		HTTPURLToRepo: p.HTTPURLToRepo,
	}
	r.Owner.Login = p.Owner()
	return r
}

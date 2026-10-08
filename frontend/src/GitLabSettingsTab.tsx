import { PluginApiClient, PluginQueryClientProvider } from "@paca-ai/plugin-sdk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Check,
  GitBranch,
  GitPullRequest,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  type AccessibleRepo,
  accessibleReposKey,
  deleteGitLabToken,
  ErrorCode,
  getPluginErrorCode,
  type GitLabIntegration,
  type GitLabTokenKind,
  getGitLabIntegration,
  integrationKey,
  type LinkedRepository,
  linkedReposKey,
  listAccessibleRepos,
  listLinkedRepositories,
  linkRepository,
  setGitLabToken,
  unlinkRepository,
} from "./gitlab-api";
import { t } from "./i18n";

// ── Utilities ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ── GitLab Icon ────────────────────────────────────────────────────────────────

function GitLabIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>GitLab</title>
      <path
        fill="currentColor"
        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
      />
    </svg>
  );
}

// ── Simple UI Primitives ───────────────────────────────────────────────────────

function Btn({
  children,
  variant = "default",
  size = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline:
      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    destructive:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
  };
  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
  };
  return (
    <button
      type="button"
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

function Inp({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[7.5vh] p-4 overflow-y-auto"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function ModalContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative z-10 mx-auto flex flex-col max-h-[85vh] lg:h-[85vh] overflow-hidden rounded-lg border border-border bg-background shadow-xl w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── Token card ────────────────────────────────────────────────────────────────

function TokenCard({
  api,
  projectId,
  hasIntegration,
  onTokenSet,
  canEdit,
  locale,
  integration,
}: {
  api: PluginApiClient;
  projectId: string;
  hasIntegration: boolean;
  onTokenSet: () => void;
  canEdit: boolean;
  locale?: string;
  integration?: GitLabIntegration | null;
}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [instanceUrl, setInstanceUrl] = useState(
    integration?.instance_url || "https://gitlab.com",
  );
  const [tokenKind, setTokenKind] = useState<GitLabTokenKind>(
    integration?.token_kind || "personal",
  );
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      setGitLabToken(api, token.trim(), {
        instanceUrl: instanceUrl.trim(),
        tokenKind,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: integrationKey(projectId),
      });
      setToken("");
      setError(null);
      onTokenSet();
    },
    onError: (err: unknown) => {
      const code = getPluginErrorCode(err);
      if (code === ErrorCode.GitLabInvalidToken) {
        setError(t("settings.token.invalid", locale));
        return;
      }
      setError(t("settings.token.saveFailed", locale));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGitLabToken(api),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: integrationKey(projectId),
      });
      await queryClient.removeQueries({
        queryKey: linkedReposKey(projectId),
      });
      await queryClient.removeQueries({
        queryKey: accessibleReposKey(projectId),
      });
      setConfirmOpen(false);
    },
    onError: () => {
      setError(t("settings.token.removeFailed", locale));
    },
  });

  if (hasIntegration) {
    return (
      <>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="size-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {t("settings.token.saved", locale)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("settings.token.encrypted", locale)}
              </p>
            </div>
          </div>
          {canEdit && (
            <Btn
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive/80 hover:text-destructive border-destructive/30 hover:border-destructive/50"
              onClick={() => setConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t("settings.token.remove", locale)}
            </Btn>
          )}
        </div>

        <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
          <ModalContent className="max-w-sm p-6">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 mb-2">
              <KeyRound className="size-5 text-destructive" />
            </div>
            <h2 className="text-base font-semibold leading-none mb-1.5">
              {t("settings.token.removeTitle", locale)}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("settings.token.removeBody", locale)}
            </p>
            {deleteMutation.isError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
                {t("settings.token.removeFailed", locale)}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Btn
                variant="outline"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => setConfirmOpen(false)}
              >
                {t("settings.token.cancel", locale)}
              </Btn>
              <Btn
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("settings.token.removing", locale)}
                  </>
                ) : (
                  t("settings.token.remove", locale)
                )}
              </Btn>
            </div>
          </ModalContent>
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        {t("settings.instanceUrl.hint", locale)}.{" "}
        {t("settings.token.scopeHintBefore", locale)}{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
          api
        </code>{" "}
        {t("settings.token.scopeHintAfter", locale)}
      </p>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.instanceUrl", locale)}
        </span>
        <Inp
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          placeholder="https://gitlab.com"
          disabled={!canEdit || saveMutation.isPending}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.token.kind", locale)}
        </span>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={tokenKind}
          disabled={!canEdit || saveMutation.isPending}
          onChange={(e) => setTokenKind(e.target.value as GitLabTokenKind)}
        >
          <option value="personal">
            {t("settings.token.kind.personal", locale)}
          </option>
          <option value="project">
            {t("settings.token.kind.project", locale)}
          </option>
          <option value="group">{t("settings.token.kind.group", locale)}</option>
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.token.label", locale)}
        </span>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Inp
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError(null);
              }}
              placeholder={t("settings.token.placeholder", locale)}
              disabled={!canEdit || saveMutation.isPending}
              className={cn(
                "pr-8 font-mono text-sm",
                error ? "border-destructive focus-visible:ring-destructive/30" : "",
              )}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && token.trim()) saveMutation.mutate();
              }}
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground text-xs font-medium"
              onClick={() => setShowToken((v) => !v)}
              tabIndex={-1}
            >
              {showToken
                ? t("settings.token.hide", locale)
                : t("settings.token.show", locale)}
            </button>
          </div>
          <Btn
            size="sm"
            disabled={!token.trim() || !canEdit || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="shrink-0"
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {t("settings.token.save", locale)}
          </Btn>
        </div>
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

// ── Add repository dialog ─────────────────────────────────────────────────────

function AddRepoDialog({
  api,
  projectId,
  open,
  onOpenChange,
  locale,
}: {
  api: PluginApiClient;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: string;
}) {
  const queryClient = useQueryClient();
  const {
    data: repos = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: accessibleReposKey(projectId),
    queryFn: () => listAccessibleRepos(api),
    enabled: open,
    staleTime: 0,
  });
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkMutation = useMutation({
    mutationFn: (repo: AccessibleRepo) =>
      linkRepository(api, repo.owner, repo.repo_name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: linkedReposKey(projectId),
      });
      setError(null);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const code = getPluginErrorCode(err);
      if (code === ErrorCode.GitLabWebhookURLNotPublic) {
        setError(t("settings.addRepo.error.webhookNotPublic", locale));
        return;
      }
      if (code === ErrorCode.GitLabWebhookCreationFailed) {
        setError(t("settings.addRepo.error.webhookFailed", locale));
        return;
      }
      if (code === ErrorCode.GitLabRepoAlreadyLinked) {
        setError(t("settings.addRepo.error.alreadyLinked", locale));
        return;
      }
      if (code === ErrorCode.GitLabRepoNotAccessible) {
        setError(t("settings.addRepo.error.notAccessible", locale));
        return;
      }
      setError(t("settings.addRepo.error.generic", locale));
    },
  });

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSearch("");
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Modal open={open} onClose={() => handleOpenChange(false)}>
      <ModalContent className="max-w-lg p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <GitBranch className="size-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold">
            {t("settings.addRepo.title", locale)}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.addRepo.desc", locale)}
        </p>

        {/* Search + reload */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Inp
              placeholder={t("settings.addRepo.search", locale)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
              // biome-ignore lint/a11y/noAutofocus: intentional dialog autofocus
              autoFocus
            />
          </div>
          <button
            type="button"
            aria-label={t("settings.addRepo.reload", locale)}
            disabled={isFetching}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            onClick={() =>
              queryClient.refetchQueries({
                queryKey: accessibleReposKey(projectId),
              })
            }
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </button>
        </div>

        {error ? (
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        ) : null}

        {/* Repo list */}
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb]:hover:bg-border">
          <div className="space-y-1 pr-0.5">
            {isLoading ? (
              [0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg mb-1" />
              ))
            ) : repos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground/60">
                <BookOpen className="size-8" />
                <p className="text-sm">{t("settings.addRepo.empty", locale)}</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground/60 py-10">
                {t("settings.addRepo.noMatch", locale, { search })}
              </p>
            ) : (
              filtered.map((repo) => (
                <button
                  key={repo.full_name}
                  type="button"
                  disabled={linkMutation.isPending}
                  onClick={() => linkMutation.mutate(repo)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-3 text-left hover:border-border hover:bg-muted/40 transition-colors disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-3.5 text-muted-foreground/70 shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {repo.full_name}
                      </span>
                      {repo.private && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
                          {t("settings.addRepo.private", locale)}
                        </span>
                      )}
                    </div>
                    {repo.description ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate pl-5">
                        {repo.description}
                      </p>
                    ) : null}
                  </div>
                  {linkMutation.isPending &&
                  linkMutation.variables?.full_name === repo.full_name ? (
                    <Loader2 className="size-3.5 animate-spin shrink-0 text-muted-foreground" />
                  ) : (
                    <Plus className="size-3.5 shrink-0 text-muted-foreground/40" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Btn
            variant="outline"
            size="sm"
            disabled={linkMutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            {t("settings.addRepo.close", locale)}
          </Btn>
        </div>
      </ModalContent>
    </Modal>
  );
}

// ── Linked repo item ──────────────────────────────────────────────────────────

function LinkedRepoItem({
  api,
  projectId,
  repo,
  canEdit,
  locale,
}: {
  api: PluginApiClient;
  projectId: string;
  repo: LinkedRepository;
  canEdit: boolean;
  locale?: string;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkRepository(api, repo.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: linkedReposKey(projectId),
      });
      setConfirmOpen(false);
    },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <GitBranch className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <a
              href={`https://gitlab.com/${repo.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline truncate block"
            >
              {repo.full_name}
            </a>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.repos.defaultBranch", locale)}{" "}
              <code className="font-mono">{repo.default_branch}</code>
            </p>
          </div>
        </div>
        {canEdit && (
          <Btn
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Unlink className="size-3.5" />
            {t("settings.unlink.action", locale)}
          </Btn>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <ModalContent className="max-w-sm p-6">
          <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 mb-2">
            <Unlink className="size-5 text-destructive" />
          </div>
          <h2 className="text-base font-semibold leading-none mb-1.5">
            {t("settings.unlink.title", locale)}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.unlink.bodyBefore", locale)}{" "}
            <span className="font-semibold text-foreground">
              {repo.full_name}
            </span>{" "}
            {t("settings.unlink.bodyAfter", locale)}
          </p>
          {unlinkMutation.isError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
              {t("settings.unlink.failed", locale)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Btn
              variant="outline"
              size="sm"
              disabled={unlinkMutation.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              {t("common.cancel", locale)}
            </Btn>
            <Btn
              variant="destructive"
              size="sm"
              disabled={unlinkMutation.isPending}
              onClick={() => unlinkMutation.mutate()}
            >
              {unlinkMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("settings.unlink.unlinking", locale)}
                </>
              ) : (
                t("settings.unlink.confirm", locale)
              )}
            </Btn>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}

// ── Main Settings ─────────────────────────────────────────────────────────────

function GitLabSettingsInner({
  api,
  projectId,
  canEdit,
  locale,
}: {
  api: PluginApiClient;
  projectId: string;
  canEdit: boolean;
  locale?: string;
}) {
  const { data: integration, isLoading: integrationLoading } = useQuery<
    GitLabIntegration | undefined
  >({
    queryKey: integrationKey(projectId),
    queryFn: () => getGitLabIntegration(api),
    retry: false,
    throwOnError: false,
  });

  const { data: linkedRepos = [], isLoading: reposLoading } = useQuery<
    LinkedRepository[]
  >({
    queryKey: linkedReposKey(projectId),
    queryFn: () => listLinkedRepositories(api),
    retry: false,
    throwOnError: false,
    enabled: !!integration,
  });

  const queryClient = useQueryClient();
  const hasIntegration = integration?.connected === true;
  const hasRepos = linkedRepos.length > 0;

  const [addRepoOpen, setAddRepoOpen] = useState(false);

  const steps = [
    {
      num: 1,
      label: t("settings.step.connectToken", locale),
      done: hasIntegration,
    },
    {
      num: 2,
      label: t("settings.step.linkRepo", locale),
      done: hasRepos,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-3 mb-1">
          <GitLabIcon className="size-5 text-foreground/80" />
          <h3 className="font-[Syne] text-base font-semibold">
            {t("settings.integrationTitle", locale)}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          {t("settings.integrationDesc", locale)}
        </p>

        {/* Progress steps */}
        <div className="flex items-center gap-4 mb-6">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-colors",
                  step.done
                    ? "bg-emerald-500 text-white"
                    : "border-2 border-border text-muted-foreground/60",
                )}
              >
                {step.done ? <Check className="size-3.5" /> : step.num}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  step.done ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <div className="h-px w-8 bg-border/60 shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Token section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-3.5 text-muted-foreground/70" />
            <label className="text-sm font-semibold text-foreground/80">
              {t("settings.token.label", locale)}
            </label>
          </div>
          {integrationLoading ? (
            <Skeleton className="h-10 rounded-lg max-w-xs" />
          ) : (
            <TokenCard
              api={api}
              projectId={projectId}
              hasIntegration={hasIntegration}
              onTokenSet={() => setAddRepoOpen(true)}
              canEdit={canEdit}
              locale={locale}
              integration={integration}
            />
          )}
        </div>
      </div>

      {/* Repository section — only after token */}
      {hasIntegration && (
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <GitPullRequest className="size-4 text-foreground/80" />
              <h3 className="font-[Syne] text-base font-semibold">
                {t("settings.repos.title", locale)}
              </h3>
              <button
                type="button"
                aria-label={t("settings.repos.reload", locale)}
                disabled={reposLoading}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-30"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: linkedReposKey(projectId),
                  })
                }
              >
                {reposLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
              </button>
            </div>
            {canEdit && (
              <Btn
                variant="outline"
                size="sm"
                onClick={() => setAddRepoOpen(true)}
              >
                <Plus className="size-3.5" />
                {t("settings.repos.link", locale)}
              </Btn>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {hasRepos
              ? t("settings.repos.webhooksAuto", locale)
              : t("settings.repos.emptyHint", locale)}
          </p>

          {reposLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-2">
              {linkedRepos.map((repo) => (
                <LinkedRepoItem
                  key={repo.id}
                  api={api}
                  projectId={projectId}
                  repo={repo}
                  canEdit={canEdit}
                  locale={locale}
                />
              ))}

              {!hasRepos && (
                <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground/60">
                  <GitBranch className="size-8" />
                  <p className="text-sm">{t("settings.repos.empty", locale)}</p>
                  {canEdit && (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => setAddRepoOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      {t("settings.repos.linkFirst", locale)}
                    </Btn>
                  )}
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <AddRepoDialog
              api={api}
              projectId={projectId}
              open={addRepoOpen}
              onOpenChange={setAddRepoOpen}
              locale={locale}
            />
          )}
        </div>
      )}

      {/* Webhook hint */}
      {hasRepos && (
        <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 border border-border/40 px-4 py-3">
          <AlertCircle className="size-4 text-muted-foreground/70 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("settings.webhook.hint", locale)}
          </p>
        </div>
      )}

      {/* No integration hint */}
      {!hasIntegration && !integrationLoading && (
        <div className="flex items-start gap-2.5 rounded-lg bg-muted/30 border border-dashed border-border/50 px-4 py-3">
          <X className="size-4 text-muted-foreground/50 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {t("settings.noIntegration", locale)}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

interface GitLabSettingsTabProps {
  projectId: string;
  canEdit?: boolean;
  /** Host locale hint (e.g. "it", "en-US"). Falls back to navigator.language. */
  locale?: string;
}

export default function GitLabSettingsTab({
  projectId,
  canEdit = true,
  locale,
}: GitLabSettingsTabProps) {
  const api = useMemo(
    () =>
      new PluginApiClient({
        baseUrl: `${window.location.origin}/api/v1`,
        projectId,
        fetch: (url, init) =>
          window.fetch(url, { ...init, credentials: "include" }),
      }),
    [projectId],
  );

  return (
    <PluginQueryClientProvider>
      <GitLabSettingsInner
        api={api}
        projectId={projectId}
        canEdit={canEdit}
        locale={locale}
      />
    </PluginQueryClientProvider>
  );
}

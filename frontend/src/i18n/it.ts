import type { MessageKey } from "./en";

const it: Record<MessageKey, string> = {
  "settings.title": "GitLab",
  "settings.token.saved": "Token di accesso salvato",
  "settings.token.encrypted": "Il token è cifrato. Non viene mai restituito dall’API.",
  "settings.token.remove": "Rimuovi token",
  "settings.token.removeTitle": "Rimuovi token GitLab",
  "settings.token.removeBody":
    "Rimuovendo il token verranno scollegati tutti i progetti e disabilitati i webhook. L’azione non è reversibile.",
  "settings.token.cancel": "Annulla",
  "settings.token.save": "Salva token",
  "settings.token.label": "Token di accesso",
  "settings.token.placeholder": "glpat-… o project/group access token",
  "settings.token.kind": "Tipo di token",
  "settings.token.kind.personal": "Personal access token",
  "settings.token.kind.project": "Project access token",
  "settings.token.kind.group": "Group access token",
  "settings.instanceUrl": "URL istanza GitLab",
  "settings.instanceUrl.hint": "Default https://gitlab.com — Self-Managed: URL base della tua istanza",
  "settings.token.invalid":
    "GitLab ha rifiutato il token. Verifica lo scope api e il ruolo Maintainer/Owner per i webhook.",
  "settings.token.saveFailed": "Salvataggio token non riuscito. Riprova.",
  "settings.token.removeFailed": "Rimozione token non riuscita. Riprova.",
  "settings.repos.title": "Progetti collegati",
  "settings.repos.link": "Collega progetto",
  "task.section.title": "GitLab",
  "task.mr.link": "Collega merge request",
  "task.mr.create": "Crea merge request",
  "task.branch.create": "Crea branch su GitLab",
  "common.loading": "Caricamento…",
  "common.error": "Qualcosa è andato storto",
};

export default it;

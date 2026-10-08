import type { MessageKey } from "./en";

const it: Record<MessageKey, string> = {
  "settings.title": "GitLab",
  "settings.integrationTitle": "Integrazione GitLab",
  "settings.integrationDesc":
    "Collega i repository GitLab per tracciare le merge request, creare branch dalle task e ricevere automaticamente gli eventi webhook. Puoi collegare più repository a un unico progetto.",
  "settings.step.connectToken": "Collega un token GitLab",
  "settings.step.linkRepo": "Collega un repository",

  "settings.token.saved": "Token di accesso salvato",
  "settings.token.encrypted":
    "Il token è cifrato. Non viene mai restituito dall’API.",
  "settings.token.remove": "Rimuovi token",
  "settings.token.removeTitle": "Rimuovi token GitLab",
  "settings.token.removeBody":
    "Rimuovendo il token verranno scollegati tutti i repository e disabilitati i webhook. L’azione non è reversibile.",
  "settings.token.cancel": "Annulla",
  "settings.token.removing": "Rimozione…",
  "settings.token.save": "Salva token",
  "settings.token.label": "Token di accesso",
  "settings.token.placeholder": "glpat-… o project/group access token",
  "settings.token.kind": "Tipo di token",
  "settings.token.kind.personal": "Personal access token",
  "settings.token.kind.project": "Project access token",
  "settings.token.kind.group": "Group access token",
  "settings.token.scopeHintBefore":
    "Usa un Personal, Project o Group Access Token con scope",
  "settings.token.scopeHintAfter":
    "(ruolo Maintainer/Owner richiesto per creare i webhook di progetto).",
  "settings.token.show": "mostra",
  "settings.token.hide": "nascondi",
  "settings.instanceUrl": "URL istanza GitLab",
  "settings.instanceUrl.hint":
    "Default https://gitlab.com — Self-Managed: URL base della tua istanza",
  "settings.token.invalid":
    "GitLab ha rifiutato il token. Verifica lo scope api e il ruolo Maintainer/Owner per i webhook.",
  "settings.token.saveFailed": "Salvataggio token non riuscito. Riprova.",
  "settings.token.removeFailed": "Rimozione token non riuscita. Riprova.",

  "settings.repos.title": "Repository collegati",
  "settings.repos.link": "Aggiungi repository",
  "settings.repos.linkFirst": "Aggiungi il primo repository",
  "settings.repos.empty": "Nessun repository collegato.",
  "settings.repos.emptyHint":
    "Nessun repository collegato. Collega un repository per tracciare merge request e branch.",
  "settings.repos.webhooksAuto":
    "I webhook vengono registrati automaticamente per ogni repository collegato.",
  "settings.repos.reload": "Ricarica repository collegati",
  "settings.repos.defaultBranch": "Branch predefinito:",

  "settings.addRepo.title": "Aggiungi repository",
  "settings.addRepo.desc":
    "Seleziona un repository dal tuo account GitLab da collegare a questo progetto. Verrà registrato automaticamente un webhook.",
  "settings.addRepo.search": "Cerca repository…",
  "settings.addRepo.reload": "Ricarica repository",
  "settings.addRepo.empty": "Nessun repository accessibile trovato.",
  "settings.addRepo.noMatch": 'Nessun repository corrisponde a "{search}"',
  "settings.addRepo.private": "Privato",
  "settings.addRepo.close": "Chiudi",
  "settings.addRepo.error.webhookNotPublic":
    "Impossibile registrare il webhook perché questo URL API non è raggiungibile pubblicamente (ad esempio localhost). Configura PUBLIC_URL con un URL HTTPS pubblico e riprova.",
  "settings.addRepo.error.webhookFailed":
    "Impossibile creare il webhook. Assicurati che il token abbia lo scope api, che tu sia Maintainer/Owner sul progetto e che PUBLIC_URL sia un URL HTTPS pubblico raggiungibile da GitLab.",
  "settings.addRepo.error.alreadyLinked":
    "Questo repository è già collegato al progetto.",
  "settings.addRepo.error.notAccessible":
    "Repository non trovato o non accessibile. Verifica che il token abbia lo scope api.",
  "settings.addRepo.error.generic":
    "Collegamento del repository non riuscito. Riprova.",

  "settings.unlink.action": "Scollega",
  "settings.unlink.title": "Scollega repository",
  "settings.unlink.bodyBefore": "Questo rimuoverà il collegamento a",
  "settings.unlink.bodyAfter":
    "e tenterà di eliminare il webhook da GitLab.",
  "settings.unlink.confirm": "Scollega repository",
  "settings.unlink.unlinking": "Scollegamento…",
  "settings.unlink.failed": "Scollegamento non riuscito. Riprova.",

  "settings.webhook.hint":
    "I webhook sono registrati su tutti i repository collegati. GitLab invierà eventi merge_request per mantenere lo stato delle MR sincronizzato automaticamente.",
  "settings.noIntegration":
    "Nessuna integrazione GitLab configurata. Aggiungi un token di accesso per iniziare.",

  "task.section.title": "GitLab",
  "task.mr.title": "Merge Request",
  "task.mr.link": "Collega merge request",
  "task.mr.create": "Crea merge request",
  "task.mr.empty": "Nessuna merge request collegata.",
  "task.mr.unlink": "Scollega merge request",
  "task.mr.state.open": "Aperta",
  "task.mr.state.merged": "Merged",
  "task.mr.state.closed": "Chiusa",
  "task.mr.by": "di {author}",
  "task.mr.repository": "Repository",
  "task.mr.selectRepo": "Seleziona repository…",
  "task.mr.inputLabel": "Numero PR o URL GitLab",
  "task.mr.placeholder":
    "42 oppure https://gitlab.com/owner/repo/-/merge_requests/42",
  "task.mr.willLink": "Collegherà la PR #{number} da {repo}",
  "task.mr.error.noToken": "Nessun token GitLab configurato per questo progetto.",
  "task.mr.error.repoNotFound":
    "Repository non trovato. Potrebbe essere stato scollegato.",
  "task.mr.error.prNotFound":
    "La PR #{number} non è stata trovata nel repository selezionato.",
  "task.mr.error.alreadyLinked": "La PR #{number} è già collegata a questa task.",
  "task.mr.error.permissions":
    "Il token GitLab non ha i permessi per leggere le merge request. Aggiornalo in Impostazioni progetto > GitLab.",
  "task.mr.error.generic": "Collegamento merge request non riuscito. Riprova.",
  "task.mr.error.repoNotLinked":
    'Il repository "{name}" non è collegato a questo progetto.',
  "task.mr.error.selectRepo": "Seleziona un repository.",
  "task.mr.error.invalidInput":
    "Inserisci un numero PR valido o incolla un URL di PR GitLab.",

  "task.branch.title": "Branch",
  "task.branch.create": "Crea branch su GitLab",
  "task.branch.createShort": "Crea branch",
  "task.branch.link": "Collega branch esistente",
  "task.branch.linkAction": "Collega branch",
  "task.branch.empty": "Nessun branch collegato.",
  "task.branch.type": "Tipo",
  "task.branch.name": "Nome branch",
  "task.branch.repository": "Repository",
  "task.branch.selectRepo": "Seleziona repository…",
  "task.branch.source": "Branch di origine",
  "task.branch.sourceOptional":
    "(opzionale, predefinito: branch di default del repo)",
  "task.branch.orLocal": "Oppure crea in locale:",
  "task.branch.copy": "Copia negli appunti",
  "task.branch.nameOrUrl": "Nome branch o URL GitLab",
  "task.branch.placeholder":
    "feature/foo oppure https://gitlab.com/owner/repo/tree/feature/foo",
  "task.branch.willLink": "Collegherà il branch {branch} da {repo}",
  "task.branch.error.noToken":
    "Nessun token GitLab configurato per questo progetto.",
  "task.branch.error.repoNotFound":
    "Repository non trovato. Potrebbe essere stato scollegato.",
  "task.branch.error.alreadyLinked":
    "Questo branch è già collegato alla task.",
  "task.branch.error.alreadyLinkedNamed":
    'Il branch "{branch}" è già collegato a questa task.',
  "task.branch.error.notFound":
    'Il branch "{branch}" non è stato trovato nel repository selezionato.',
  "task.branch.error.permissionsCreate":
    "Il token GitLab non ha i permessi per creare branch. Aggiornalo in Impostazioni progetto > GitLab con un token che abbia lo scope api.",
  "task.branch.error.permissionsRead":
    "Il token GitLab non ha i permessi per leggere i branch. Aggiornalo in Impostazioni progetto > GitLab.",
  "task.branch.error.createFailed": "Creazione branch non riuscita. Riprova.",
  "task.branch.error.linkFailed": "Collegamento branch non riuscito. Riprova.",
  "task.branch.error.nameRequired": "Il nome del branch è obbligatorio.",
  "task.branch.error.selectRepo": "Seleziona un repository.",
  "task.branch.error.invalidInput":
    "Inserisci un nome di branch o incolla un URL di branch GitLab.",
  "task.branch.error.repoNotLinked":
    'Il repository "{name}" non è collegato a questo progetto.',

  "common.loading": "Caricamento…",
  "common.error": "Qualcosa è andato storto",
  "common.cancel": "Annulla",
};

export default it;

let demandesClient = [];
let profilClientCourant = null;

const DEMANDES_PAR_AFFICHAGE = 3;
let nombreDemandesAffichees = DEMANDES_PAR_AFFICHAGE;

let clientPhotoASupprimer = false;
let clientPhotoTemporaireUrl = null;

function valeurProfil(valeur) {
  const texte = String(valeur ?? "").trim();
  return texte || "Non précisé";
}

function synchroniserUtilisateurClient(utilisateur) {
  if (!utilisateur) return;
  window.utilisateurCourant = {
    ...(window.utilisateurCourant || {}),
    ...utilisateur
  };
}

// Calculer les compteurs du client
function statsDemandes(demandes) {
  return {
    total: demandes.length,
    en_attente: demandes.filter((d) => d.statut === "en_attente").length,
    terminee: demandes.filter((d) => d.statut === "terminee").length,
    annulee: demandes.filter((d) => d.statut === "annulee" || d.statut === "refusee").length
  };
}

// Afficher les statistiques du client
function afficherStatsClient() {
  const cible = document.getElementById("client-stats");
  if (!cible) return;

  const stats = statsDemandes(demandesClient);
  cible.innerHTML = `
    <div class="stat-card"><span>Total demandes</span><strong>${stats.total}</strong></div>
    <div class="stat-card"><span>En attente</span><strong>${stats.en_attente}</strong></div>
    <div class="stat-card"><span>Terminées</span><strong>${stats.terminee}</strong></div>
    <div class="stat-card"><span>Annulées ou refusées</span><strong>${stats.annulee}</strong></div>
  `;
}

// Construire une carte demande client
function carteDemandeClient(demande) {
  const peutAnnuler = demande.statut === "en_attente";
  const peutAvis = demande.statut === "terminee" && !demande.avis_id;
  const dejaAvis = demande.avis_id;

  return `
    <article class="request-card">
      <div class="request-head">
        <div>
          <h3>${echapperHTML(demande.service_nom || "Service")}</h3>
          <p class="muted">Avec ${echapperHTML(nomComplet(demande, "artisan_"))} · ${echapperHTML(demande.artisan_ville || "")}</p>
        </div>
        ${badgeStatut(demande.statut)}
      </div>
      <p>${echapperHTML(demande.message || "Aucun message.")}</p>
      <div class="meta-row mt-14">
        <span class="badge">Adresse : ${echapperHTML(demande.adresse || "Non précisée")}</span>
        <span class="badge">Date souhaitée : ${formatDate(demande.date_souhaitee)}</span>
        <span class="badge">Créée le ${formatDate(demande.created_at)}</span>
        ${dejaAvis ? `<span class="badge accent">Avis : ${demande.avis_note}/5</span>` : ""}
      </div>
      ${demande.motif_annulation ? `<p class="alert show warning mt-14">Motif d'annulation : ${echapperHTML(demande.motif_annulation)}</p>` : ""}
      <div class="request-actions">
        ${peutAnnuler ? `<button class="btn outline" type="button" data-cancel-request="${demande.id}">Annuler</button>` : ""}
        ${peutAvis ? `<button class="btn primary" type="button" data-open-review="${demande.id}">Laisser un avis</button>` : ""}
        <button class="btn danger" type="button" data-open-report="${demande.id}">Signaler</button>
      </div>
    </article>
  `;
}

function ajusterNombreDemandesAffichees() {
  nombreDemandesAffichees = Math.min(
    Math.max(nombreDemandesAffichees, DEMANDES_PAR_AFFICHAGE),
    Math.max(demandesClient.length, DEMANDES_PAR_AFFICHAGE)
  );
}

function afficherControlesDemandesClient() {
  const controles = document.getElementById("client-requests-controls");
  const compteur = document.getElementById("client-requests-count");
  const bouton = document.getElementById("client-load-more-btn");
  if (!controles || !compteur || !bouton) return;

  const total = demandesClient.length;
  const affiches = Math.min(nombreDemandesAffichees, total);

  if (total <= DEMANDES_PAR_AFFICHAGE) {
    controles.hidden = true;
    compteur.textContent = "";
    bouton.hidden = true;
    return;
  }

  controles.hidden = false;
  compteur.textContent = `${affiches} demande${affiches > 1 ? "s" : ""} affichée${affiches > 1 ? "s" : ""} sur ${total}`;
  bouton.hidden = affiches >= total;
}

// Afficher les demandes du client
function afficherDemandesClient() {
  const cible = document.getElementById("client-requests");
  if (!cible) return;

  if (!demandesClient.length) {
    cible.innerHTML = etatVide("Aucune demande pour le moment. Parcourez les artisans pour démarrer.");
    afficherControlesDemandesClient();
    return;
  }

  const demandesVisibles = demandesClient.slice(0, nombreDemandesAffichees);
  cible.innerHTML = demandesVisibles.map(carteDemandeClient).join("");
  afficherControlesDemandesClient();
}

// Charger les demandes depuis le backend
async function chargerDemandesClient() {
  const cible = document.getElementById("client-requests");
  if (cible) cible.innerHTML = etatChargement("Chargement de vos demandes...");

  try {
    const data = await requeteAPI("/api/demandes/client");
    demandesClient = data.demandes || [];
    ajusterNombreDemandesAffichees();
    afficherStatsClient();
    afficherDemandesClient();
  } catch (error) {
    if (cible) cible.innerHTML = etatVide(error.message);
    afficherControlesDemandesClient();
  }
}

// Annuler une demande en attente
async function annulerDemandeClient(id) {
  try {
    await requeteAPI(`/api/demandes/${id}/annuler`, { method: "PUT" });
    afficherToast("Demande annulée avec succès.");
    chargerDemandesClient();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Ouvrir la modale d'avis
function ouvrirAvisClient(id) {
  document.getElementById("review-demande-id").value = id;
  ouvrirModale("review-modal");
}

// Ouvrir la modale de signalement
function ouvrirSignalementClient(id) {
  document.getElementById("report-demande-id").value = id;
  ouvrirModale("report-modal");
}

// Initialiser les actions sur les demandes
function initialiserActionsClient() {
  document.addEventListener("click", (event) => {
    const chargerPlus = event.target.closest("#client-load-more-btn");
    const annuler = event.target.closest("[data-cancel-request]");
    const avis = event.target.closest("[data-open-review]");
    const signaler = event.target.closest("[data-open-report]");

    if (chargerPlus) {
      nombreDemandesAffichees += DEMANDES_PAR_AFFICHAGE;
      afficherDemandesClient();
    }

    if (annuler) annulerDemandeClient(annuler.dataset.cancelRequest);
    if (avis) ouvrirAvisClient(avis.dataset.openReview);
    if (signaler) ouvrirSignalementClient(signaler.dataset.openReport);
  });

  document.getElementById("review-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI("/api/avis", {
        method: "POST",
        body: JSON.stringify({
          demandeId: Number(document.getElementById("review-demande-id").value),
          note: Number(document.getElementById("review-note").value),
          commentaire: document.getElementById("review-comment").value.trim()
        })
      });
      afficherToast("Votre avis a été envoyé.");
      fermerModale("review-modal");
      form.reset();
      chargerDemandesClient();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("report-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI("/api/signalements", {
        method: "POST",
        body: JSON.stringify({
          demandeId: Number(document.getElementById("report-demande-id").value),
          motif: document.getElementById("report-motif").value,
          description: document.getElementById("report-description").value.trim()
        })
      });
      afficherToast("Votre signalement a été envoyé.");
      fermerModale("report-modal");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

function mettreAJourBienvenueClient() {
  const bienvenue = document.getElementById("client-welcome");
  if (bienvenue && window.utilisateurCourant) {
    bienvenue.textContent = `Bienvenue ${nomComplet(window.utilisateurCourant)}`;
  }
}

// Charger le profil client complet
async function chargerProfilClientDashboard() {
  const cible = document.getElementById("client-profile-card");
  if (cible) cible.innerHTML = etatChargement("Chargement du profil...");

  const data = await requeteAPI("/api/auth/profile");
  profilClientCourant = data;
  synchroniserUtilisateurClient(data.utilisateur);
  afficherProfilClient();
  return data;
}

// Afficher le profil client
function afficherProfilClient() {
  const cible = document.getElementById("client-profile-card");
  if (!cible || !window.utilisateurCourant) return;

  const utilisateur = profilClientCourant?.utilisateur || window.utilisateurCourant;
  const profil = profilClientCourant?.profil || {};

  mettreAJourBienvenueClient();

  cible.innerHTML = `
    <div class="profile-panel">
      <img class="avatar large" src="${echapperHTML(imageProfil(utilisateur.photo_profil))}" alt="${echapperHTML(nomComplet(utilisateur))}" onerror="this.src='${DEFAULT_AVATAR}'">
      <div>
        <h3>${echapperHTML(nomComplet(utilisateur))}</h3>
        <p class="muted">${echapperHTML(utilisateur.email || "Non précisé")}</p>
        <span class="badge primary">Compte client</span>
      </div>
    </div>
    <div class="profile-fields">
      <div><strong>Nom</strong><br><span class="muted">${echapperHTML(valeurProfil(utilisateur.nom))}</span></div>
      <div><strong>Prénom</strong><br><span class="muted">${echapperHTML(valeurProfil(utilisateur.prenom))}</span></div>
      <div><strong>Email</strong><br><span class="muted">${echapperHTML(valeurProfil(utilisateur.email))}</span></div>
      <div><strong>Téléphone</strong><br><span class="muted">${echapperHTML(valeurProfil(profil.telephone))}</span></div>
      <div><strong>Ville</strong><br><span class="muted">${echapperHTML(valeurProfil(profil.ville))}</span></div>
      <div><strong>Adresse</strong><br><span class="muted">${echapperHTML(valeurProfil(profil.adresse))}</span></div>
    </div>
  `;
}

function definirValeurChamp(id, valeur) {
  const champ = document.getElementById(id);
  if (champ) champ.value = valeur ?? "";
}

function photoClientCourante() {
  return profilClientCourant?.utilisateur?.photo_profil || window.utilisateurCourant?.photo_profil || null;
}

function definirApercuPhotoClient(chemin) {
  const apercu = document.getElementById("client-profile-photo-preview");
  if (apercu) apercu.src = imageProfil(chemin);
}

function libererApercuClient() {
  if (clientPhotoTemporaireUrl) {
    URL.revokeObjectURL(clientPhotoTemporaireUrl);
    clientPhotoTemporaireUrl = null;
  }
}

function reinitialiserPhotoClientTemporaire() {
  const input = document.getElementById("client-profile-photo");
  if (input) input.value = "";
  clientPhotoASupprimer = false;
  libererApercuClient();
  definirApercuPhotoClient(photoClientCourante());
}

function remplirModaleProfilClient() {
  const utilisateur = profilClientCourant?.utilisateur || window.utilisateurCourant || {};
  const profil = profilClientCourant?.profil || {};

  definirValeurChamp("client-profile-nom", utilisateur.nom || "");
  definirValeurChamp("client-profile-prenom", utilisateur.prenom || "");
  definirValeurChamp("client-profile-email", utilisateur.email || "");
  definirValeurChamp("client-profile-telephone", profil.telephone || "");
  definirValeurChamp("client-profile-ville", profil.ville || "");
  definirValeurChamp("client-profile-adresse", profil.adresse || "");
  reinitialiserPhotoClientTemporaire();
}

function reinitialiserModaleProfilClient() {
  document.getElementById("client-profile-form")?.reset();
  reinitialiserPhotoClientTemporaire();
}

async function ouvrirModaleProfilClient() {
  try {
    if (!profilClientCourant) {
      await chargerProfilClientDashboard();
    }
    remplirModaleProfilClient();
    ouvrirModale("client-profile-modal");
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Initialiser la modification du profil client
function initialiserProfilClient() {
  document.getElementById("client-edit-profile-btn")?.addEventListener("click", ouvrirModaleProfilClient);

  document.getElementById("client-profile-photo")?.addEventListener("change", (event) => {
    const fichier = event.target.files[0];
    if (!fichier) return;

    const typesAutorises = ["image/jpeg", "image/png", "image/webp"];
    if (!typesAutorises.includes(fichier.type)) {
      afficherToast("Veuillez choisir une image JPEG, PNG ou WebP.", "error");
      event.target.value = "";
      return;
    }

    libererApercuClient();
    clientPhotoASupprimer = false;
    clientPhotoTemporaireUrl = URL.createObjectURL(fichier);
    definirApercuPhotoClient(clientPhotoTemporaireUrl);
  });

  document.getElementById("client-profile-photo-delete")?.addEventListener("click", () => {
    const input = document.getElementById("client-profile-photo");
    if (input) input.value = "";
    libererApercuClient();
    clientPhotoASupprimer = true;
    definirApercuPhotoClient(null);
  });

  document.getElementById("client-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    const telephone = document.getElementById("client-profile-telephone").value.trim();
    const ville = document.getElementById("client-profile-ville").value.trim();
    const adresse = document.getElementById("client-profile-adresse").value.trim();

    if (!telephone || !ville || !adresse) {
      afficherToast("Veuillez remplir les champs obligatoires.", "error");
      return;
    }

    bouton.disabled = true;

    try {
      await requeteAPI("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ telephone, ville, adresse })
      });

      const inputPhoto = document.getElementById("client-profile-photo");
      if (inputPhoto?.files.length) {
        const data = new FormData();
        data.append("photo", inputPhoto.files[0]);
        const reponse = await requeteAPI("/api/auth/photo", {
          method: "PUT",
          body: data
        });
        window.utilisateurCourant.photo_profil = reponse.photo_profil;
      } else if (clientPhotoASupprimer) {
        await requeteAPI("/api/auth/photo", { method: "DELETE" });
        window.utilisateurCourant.photo_profil = null;
      }

      await chargerProfilClientDashboard();
      construireHeader();
      fermerModale("client-profile-modal");
      reinitialiserModaleProfilClient();
      afficherToast("Profil mis à jour avec succès.");
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.addEventListener("click", (event) => {
    const fermerProfil = event.target.closest('[data-close-modal="client-profile-modal"]') || event.target.id === "client-profile-modal";
    if (fermerProfil) {
      window.setTimeout(reinitialiserModaleProfilClient, 0);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (!window.utilisateurCourant || window.utilisateurCourant.role !== "client") return;
  mettreAJourBienvenueClient();
  try {
    await chargerProfilClientDashboard();
  } catch (error) {
    const cible = document.getElementById("client-profile-card");
    if (cible) cible.innerHTML = etatVide(error.message);
  }
  afficherStatsClient();
  initialiserProfilClient();
  initialiserActionsClient();
  chargerDemandesClient();
});

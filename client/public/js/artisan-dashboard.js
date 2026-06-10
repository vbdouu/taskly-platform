let demandesArtisan = [];
let profilArtisanCourant = null;

let artisanPhotoASupprimer = false;
let artisanPhotoTemporaireUrl = null;

function valeurProfilArtisan(valeur) {
  const texte = String(valeur ?? "").trim();
  return texte || "Non précisé";
}

function synchroniserUtilisateurArtisan(utilisateur) {
  if (!utilisateur) return;
  window.utilisateurCourant = {
    ...(window.utilisateurCourant || {}),
    ...utilisateur
  };
}

// Calculer les compteurs artisan
function statsDemandesArtisan(demandes) {
  return {
    total: demandes.length,
    en_attente: demandes.filter((d) => d.statut === "en_attente").length,
    acceptee: demandes.filter((d) => d.statut === "acceptee").length,
    terminee: demandes.filter((d) => d.statut === "terminee").length
  };
}

// Afficher les statistiques artisan
function afficherStatsArtisan() {
  const cible = document.getElementById("artisan-stats");
  if (!cible) return;

  const stats = statsDemandesArtisan(demandesArtisan);
  cible.innerHTML = `
    <div class="stat-card"><span>Demandes reçues</span><strong>${stats.total}</strong></div>
    <div class="stat-card"><span>En attente</span><strong>${stats.en_attente}</strong></div>
    <div class="stat-card"><span>Acceptées</span><strong>${stats.acceptee}</strong></div>
    <div class="stat-card"><span>Terminées</span><strong>${stats.terminee}</strong></div>
  `;
}

// Construire une carte demande artisan
function carteDemandeArtisan(demande) {
  const peutTraiter = demande.statut === "en_attente";
  const peutTerminer = demande.statut === "acceptee";

  return `
    <article class="request-card">
      <div class="request-head">
        <div>
          <h3>${echapperHTML(nomComplet(demande, "client_"))}</h3>
          <p class="muted">${echapperHTML(demande.client_ville || "Ville non précisée")} · ${echapperHTML(demande.client_telephone || "Téléphone non précisé")}</p>
        </div>
        ${badgeStatut(demande.statut)}
      </div>
      <p>${echapperHTML(demande.message || "Aucun message.")}</p>
      <div class="meta-row mt-14">
        <span class="badge">Adresse : ${echapperHTML(demande.adresse || demande.client_adresse || "Non précisée")}</span>
        <span class="badge">Date souhaitée : ${formatDate(demande.date_souhaitee)}</span>
        <span class="badge">Créée le ${formatDate(demande.created_at)}</span>
      </div>
      ${demande.motif_annulation ? `<p class="alert show warning mt-14">Motif d'annulation : ${echapperHTML(demande.motif_annulation)}</p>` : ""}
      <div class="request-actions">
        ${peutTraiter ? `<button class="btn primary" type="button" data-set-status="${demande.id}" data-status="acceptee">Accepter</button>` : ""}
        ${peutTraiter ? `<button class="btn outline" type="button" data-set-status="${demande.id}" data-status="refusee">Refuser</button>` : ""}
        ${peutTerminer ? `<button class="btn primary" type="button" data-complete-request="${demande.id}">Marquer terminée</button>` : ""}
        ${peutTerminer ? `<button class="btn outline" type="button" data-open-cancel-artisan="${demande.id}">Annuler avec motif</button>` : ""}
        <button class="btn danger" type="button" data-open-report="${demande.id}">Signaler</button>
      </div>
    </article>
  `;
}

// Afficher les demandes recues
function afficherDemandesArtisan() {
  const cible = document.getElementById("artisan-requests");
  if (!cible) return;

  if (!demandesArtisan.length) {
    cible.innerHTML = etatVide("Aucune demande reçue pour le moment.");
    return;
  }

  cible.innerHTML = demandesArtisan.map(carteDemandeArtisan).join("");
}

// Charger les demandes depuis le backend
async function chargerDemandesArtisan() {
  const cible = document.getElementById("artisan-requests");
  if (cible) cible.innerHTML = etatChargement("Chargement des demandes reçues...");

  try {
    const data = await requeteAPI("/api/demandes/artisan");
    demandesArtisan = data.demandes || [];
    afficherStatsArtisan();
    afficherDemandesArtisan();
  } catch (error) {
    if (cible) cible.innerHTML = etatVide(error.message);
  }
}

// Changer le statut d'une demande
async function changerStatutDemande(id, statut) {
  try {
    await requeteAPI(`/api/demandes/${id}/statut`, {
      method: "PUT",
      body: JSON.stringify({ statut })
    });
    afficherToast("Statut mis à jour.");
    chargerDemandesArtisan();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Marquer une demande comme terminee
async function terminerDemandeArtisan(id) {
  try {
    await requeteAPI(`/api/demandes/${id}/terminer`, { method: "PUT" });
    afficherToast("Travail marqué comme terminé.");
    chargerDemandesArtisan();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Ouvrir la modale d'annulation artisan
function ouvrirAnnulationArtisan(id) {
  document.getElementById("cancel-artisan-demande-id").value = id;
  ouvrirModale("cancel-artisan-modal");
}

// Ouvrir la modale de signalement artisan
function ouvrirSignalementArtisan(id) {
  document.getElementById("artisan-report-demande-id").value = id;
  ouvrirModale("artisan-report-modal");
}

// Initialiser les actions artisan
function initialiserActionsArtisan() {
  document.addEventListener("click", (event) => {
    const statut = event.target.closest("[data-set-status]");
    const terminer = event.target.closest("[data-complete-request]");
    const annuler = event.target.closest("[data-open-cancel-artisan]");
    const signaler = event.target.closest("[data-open-report]");

    if (statut) changerStatutDemande(statut.dataset.setStatus, statut.dataset.status);
    if (terminer) terminerDemandeArtisan(terminer.dataset.completeRequest);
    if (annuler) ouvrirAnnulationArtisan(annuler.dataset.openCancelArtisan);
    if (signaler) ouvrirSignalementArtisan(signaler.dataset.openReport);
  });

  document.getElementById("cancel-artisan-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI(`/api/demandes/${document.getElementById("cancel-artisan-demande-id").value}/annuler-artisan`, {
        method: "PUT",
        body: JSON.stringify({
          motifAnnulation: document.getElementById("cancel-artisan-reason").value.trim()
        })
      });
      afficherToast("Demande annulée avec motif.");
      fermerModale("cancel-artisan-modal");
      form.reset();
      chargerDemandesArtisan();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("artisan-report-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI("/api/signalements", {
        method: "POST",
        body: JSON.stringify({
          demandeId: Number(document.getElementById("artisan-report-demande-id").value),
          motif: document.getElementById("artisan-report-motif").value,
          description: document.getElementById("artisan-report-description").value.trim()
        })
      });
      afficherToast("Signalement envoyé.");
      fermerModale("artisan-report-modal");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

function mettreAJourBienvenueArtisan() {
  const bienvenue = document.getElementById("artisan-welcome");
  if (bienvenue && window.utilisateurCourant) {
    bienvenue.textContent = `Bienvenue ${nomComplet(window.utilisateurCourant)}`;
  }
}

// Charger le profil de l'artisan connecte
async function chargerProfilArtisanDashboard() {
  const cible = document.getElementById("artisan-profile-card");
  if (cible) cible.innerHTML = etatChargement("Chargement du profil...");

  const data = await requeteAPI("/api/auth/profile");
  profilArtisanCourant = data.profil;
  synchroniserUtilisateurArtisan(data.utilisateur);
  afficherProfilArtisan();
  chargerAvisArtisan();
  return data;
}

// Afficher le profil artisan
function afficherProfilArtisan() {
  const cible = document.getElementById("artisan-profile-card");
  if (!cible || !window.utilisateurCourant) return;

  const utilisateur = window.utilisateurCourant;
  const profil = profilArtisanCourant || {};

  mettreAJourBienvenueArtisan();

  cible.innerHTML = `
    <div class="profile-panel">
      <img class="avatar large" src="${echapperHTML(imageProfil(utilisateur.photo_profil))}" alt="${echapperHTML(nomComplet(utilisateur))}" onerror="this.src='${DEFAULT_AVATAR}'">
      <div>
        <h3>${echapperHTML(nomComplet(utilisateur))}</h3>
        <p class="muted">${echapperHTML(profil.service_nom || "Artisan Taskly")} · ${echapperHTML(profil.ville || "")}</p>
        <div class="meta-row mt-12">
          <span class="badge primary">${Number(profil.experience || 0)} an(s) d'expérience</span>
          <span class="badge accent">${echapperHTML(noteArtisan(profil))}</span>
        </div>
      </div>
    </div>
    <div class="profile-fields">
      <div><strong>Nom</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(utilisateur.nom))}</span></div>
      <div><strong>Prénom</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(utilisateur.prenom))}</span></div>
      <div><strong>Email</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(utilisateur.email))}</span></div>
      <div><strong>Téléphone</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(profil.telephone))}</span></div>
      <div><strong>Service</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(profil.service_nom))}</span></div>
      <div><strong>Ville</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(profil.ville))}</span></div>
      <div><strong>Expérience</strong><br><span class="muted">${Number(profil.experience || 0)} an(s)</span></div>
      <div><strong>Description</strong><br><span class="muted">${echapperHTML(valeurProfilArtisan(profil.description))}</span></div>
    </div>
  `;
}

// Charger les avis de l'artisan
async function chargerAvisArtisan() {
  const cible = document.getElementById("artisan-reviews-dashboard");
  if (!cible || !profilArtisanCourant) {
    if (cible) cible.innerHTML = etatVide("Les avis apparaîtront ici après vos premières missions terminées.");
    return;
  }

  cible.innerHTML = etatChargement("Chargement des avis...");

  try {
    const { avis, statistiques } = await requeteAPI(`/api/avis/artisan/${profilArtisanCourant.id}`);
    if (!avis.length) {
      cible.innerHTML = etatVide("Aucun avis reçu pour le moment.");
      return;
    }

    cible.innerHTML = `
      <div class="alert show success">Moyenne actuelle : <strong>${statistiques.moyenne_note || 0}/5</strong> sur ${statistiques.total_avis || 0} avis.</div>
      <div class="grid three">
        ${avis.slice(0, 6).map((item) => `
          <article class="card review-card">
            <div class="card-body">
              <div class="stars">${afficherEtoiles(item.note)}</div>
              <h3>${echapperHTML(nomComplet(item, "client_"))}</h3>
              <p class="muted">${echapperHTML(item.commentaire || "Avis sans commentaire.")}</p>
              <p class="text-small muted">${formatDate(item.created_at)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

function definirValeurChampArtisan(id, valeur) {
  const champ = document.getElementById(id);
  if (champ) champ.value = valeur ?? "";
}

function photoArtisanCourante() {
  return window.utilisateurCourant?.photo_profil || null;
}

function definirApercuPhotoArtisan(chemin) {
  const apercu = document.getElementById("artisan-profile-photo-preview");
  if (apercu) apercu.src = imageProfil(chemin);
}

function libererApercuArtisan() {
  if (artisanPhotoTemporaireUrl) {
    URL.revokeObjectURL(artisanPhotoTemporaireUrl);
    artisanPhotoTemporaireUrl = null;
  }
}

function reinitialiserPhotoArtisanTemporaire() {
  const input = document.getElementById("artisan-profile-photo");
  if (input) input.value = "";
  artisanPhotoASupprimer = false;
  libererApercuArtisan();
  definirApercuPhotoArtisan(photoArtisanCourante());
}

function remplirModaleProfilArtisan() {
  const utilisateur = window.utilisateurCourant || {};
  const profil = profilArtisanCourant || {};

  definirValeurChampArtisan("artisan-profile-nom", utilisateur.nom || "");
  definirValeurChampArtisan("artisan-profile-prenom", utilisateur.prenom || "");
  definirValeurChampArtisan("artisan-profile-email", utilisateur.email || "");
  definirValeurChampArtisan("artisan-profile-service", profil.service_nom || "");
  definirValeurChampArtisan("artisan-profile-telephone", profil.telephone || "");
  definirValeurChampArtisan("artisan-profile-ville", profil.ville || "");
  definirValeurChampArtisan("artisan-profile-experience", profil.experience ?? "");
  definirValeurChampArtisan("artisan-profile-description", profil.description || "");
  reinitialiserPhotoArtisanTemporaire();
}

function reinitialiserModaleProfilArtisan() {
  document.getElementById("artisan-profile-form")?.reset();
  reinitialiserPhotoArtisanTemporaire();
}

async function ouvrirModaleProfilArtisan() {
  try {
    if (!profilArtisanCourant) {
      await chargerProfilArtisanDashboard();
    }
    remplirModaleProfilArtisan();
    ouvrirModale("artisan-profile-modal");
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Initialiser la modification du profil artisan
function initialiserProfilArtisan() {
  document.getElementById("artisan-edit-profile-btn")?.addEventListener("click", ouvrirModaleProfilArtisan);

  document.getElementById("artisan-profile-photo")?.addEventListener("change", (event) => {
    const fichier = event.target.files[0];
    if (!fichier) return;

    const typesAutorises = ["image/jpeg", "image/png", "image/webp"];
    if (!typesAutorises.includes(fichier.type)) {
      afficherToast("Veuillez choisir une image JPEG, PNG ou WebP.", "error");
      event.target.value = "";
      return;
    }

    libererApercuArtisan();
    artisanPhotoASupprimer = false;
    artisanPhotoTemporaireUrl = URL.createObjectURL(fichier);
    definirApercuPhotoArtisan(artisanPhotoTemporaireUrl);
  });

  document.getElementById("artisan-profile-photo-delete")?.addEventListener("click", () => {
    const input = document.getElementById("artisan-profile-photo");
    if (input) input.value = "";
    libererApercuArtisan();
    artisanPhotoASupprimer = true;
    definirApercuPhotoArtisan(null);
  });

  document.getElementById("artisan-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    const telephone = document.getElementById("artisan-profile-telephone").value.trim();
    const ville = document.getElementById("artisan-profile-ville").value.trim();
    const experienceTexte = document.getElementById("artisan-profile-experience").value.trim();
    const description = document.getElementById("artisan-profile-description").value.trim();
    const experience = Number(experienceTexte);

    if (!telephone || !ville || !experienceTexte) {
      afficherToast("Veuillez remplir les champs obligatoires.", "error");
      return;
    }

    if (!Number.isInteger(experience) || experience < 0) {
      afficherToast("L'expérience doit être un nombre supérieur ou égal à 0.", "error");
      return;
    }

    bouton.disabled = true;

    try {
      await requeteAPI("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ telephone, ville, experience, description })
      });

      const inputPhoto = document.getElementById("artisan-profile-photo");
      if (inputPhoto?.files.length) {
        const data = new FormData();
        data.append("photo", inputPhoto.files[0]);
        const reponse = await requeteAPI("/api/auth/photo", {
          method: "PUT",
          body: data
        });
        window.utilisateurCourant.photo_profil = reponse.photo_profil;
      } else if (artisanPhotoASupprimer) {
        await requeteAPI("/api/auth/photo", { method: "DELETE" });
        window.utilisateurCourant.photo_profil = null;
      }

      await chargerProfilArtisanDashboard();
      construireHeader();
      fermerModale("artisan-profile-modal");
      reinitialiserModaleProfilArtisan();
      afficherToast("Profil mis à jour avec succès.");
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.addEventListener("click", (event) => {
    const fermerProfil = event.target.closest('[data-close-modal="artisan-profile-modal"]') || event.target.id === "artisan-profile-modal";
    if (fermerProfil) {
      window.setTimeout(reinitialiserModaleProfilArtisan, 0);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (!window.utilisateurCourant || window.utilisateurCourant.role !== "artisan") return;
  mettreAJourBienvenueArtisan();
  try {
    await chargerProfilArtisanDashboard();
  } catch (error) {
    const cible = document.getElementById("artisan-profile-card");
    if (cible) cible.innerHTML = etatVide(error.message);
    chargerAvisArtisan();
  }
  afficherStatsArtisan();
  initialiserProfilArtisan();
  initialiserActionsArtisan();
  chargerDemandesArtisan();
});

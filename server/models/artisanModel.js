// Ce fichier contient les requêtes SQL liées à la table artisans.
// Il sera utilisé pour créer un profil artisan et récupérer les informations des artisans.

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js
const { obtenirCommunesWilaya } = require("../helpers/algeriaLocations");

// création d'un profil artisan
async function creerProfilArtisan(userId, serviceId, ville, telephone, description, experience) {
    const sql = "INSERT INTO artisans (user_id, service_id, ville, telephone, description, experience) VALUES (?, ?, ?, ?, ?, ?)"; // requete SQL pour créer un profil artisan

    const [resultat] = await db.promise().query(sql, [
        userId,
        serviceId,
        ville,
        telephone,
        description,
        experience
    ]); // on execute la requete et on attends et on recupere le resultat
    return resultat; // on retourne le resultat qui est l'id de l'artisan
}

// recuperer tous les artisans avec possibilite de filtrer
async function trouverTousLesArtisans(filtres = {}) {
    // requete qui peut changer en fonction des filtres
    let sql = `
        SELECT 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            services.nom AS service_nom,
            COALESCE(ROUND(AVG(avis.note), 1), 0) AS moyenne_notes,
            COUNT(DISTINCT avis.id) AS total_avis,
            COUNT(DISTINCT demandes.id) AS total_demandes
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON avis.artisan_id = artisans.id
        LEFT JOIN demandes ON demandes.artisan_id = artisans.id
        -- Condition toujours vraie qui permet d'ajouter facilement d'autres conditions avec AND
        WHERE 1 = 1
    `;

    const valeurs = []; // on cree un tableau pour stocker les valeurs de filtres qui vont remplacer les ?

    // Si un serviceId est fourni, on filtre les artisans par service
    if (filtres.serviceId) {
        sql += " AND artisans.service_id = ?"; // garder seulement les artisans du service demande
        valeurs.push(filtres.serviceId); // on ajoute la valeur correspondante dans le tableau, remplacera le "?" au moment de l'execution de la requete
    }

    // La recherche publique se fait au niveau Wilaya. La commune reste utile
    // pour l'adresse, mais elle ne doit pas rendre les résultats trop étroits.
    if (filtres.wilaya) {
        const lieuxWilaya = obtenirCommunesWilaya(filtres.wilaya);
        const lieux = lieuxWilaya.length ? lieuxWilaya : [filtres.wilaya];

        sql += " AND (" + lieux.map(() => "artisans.ville LIKE ?").join(" OR ") + ")";
        valeurs.push(...lieux.map((lieu) => "%" + lieu + "%"));

    } else if (filtres.ville) {
        sql += " AND artisans.ville LIKE ?";
        valeurs.push("%" + filtres.ville + "%");
    }

    // Si un mot-cle de recherche est fourni, on cherche dans plusieurs colonnes.
    if (filtres.recherche) {
        sql += `
            AND (
                users.nom LIKE ?
                OR users.prenom LIKE ?
                OR services.nom LIKE ?
                OR artisans.ville LIKE ?
                OR artisans.description LIKE ?
            )
        `;

        const recherche = "%" + filtres.recherche + "%";
        valeurs.push(recherche, recherche, recherche, recherche, recherche); // on ajoute les valeurs de recherche dans le tableau
    }

    sql += `
        GROUP BY 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            services.nom
        ORDER BY artisans.created_at DESC
    `; // on ajoute la condition de tri

    const [resultats] = await db.promise().query(sql, valeurs); // on execute la requete et on attends et on recupere le resultat

    return resultats; // on retourne tous les artisans trouves
}

// Recuperer un artisan par son id avec son utilisateur et son service
async function trouverArtisanParId(id) {
    const sql = `
        SELECT 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            services.nom AS service_nom,
            COALESCE(ROUND(AVG(avis.note), 1), 0) AS moyenne_notes,
            COUNT(DISTINCT avis.id) AS total_avis,
            COUNT(DISTINCT demandes.id) AS total_demandes
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON avis.artisan_id = artisans.id
        LEFT JOIN demandes ON demandes.artisan_id = artisans.id
        WHERE artisans.id = ?
        GROUP BY 
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            services.nom
    `;

    const [resultats] = await db.promise().query(sql, [id]); // on execute la requete
    return resultats[0]; // on retourne l'artisan
}

// Recuperer un artisan a partir de son user_id
async function trouverArtisanParUserId(userId) {
    const sql = "SELECT * FROM artisans WHERE user_id = ?";

    const [resultats] = await db.promise().query(sql, [userId]);

    return resultats[0];
}

// Recuperer le profil complet d'un artisan connecte
async function trouverProfilArtisanCompletParUserId(userId) {
    const sql = `
        SELECT
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            users.role,
            services.nom AS service_nom,
            COALESCE(ROUND(AVG(avis.note), 1), 0) AS moyenne_notes,
            COUNT(DISTINCT avis.id) AS total_avis
        FROM artisans
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON avis.artisan_id = artisans.id
        WHERE artisans.user_id = ?
        GROUP BY
            artisans.id,
            artisans.user_id,
            artisans.service_id,
            artisans.ville,
            artisans.telephone,
            artisans.description,
            artisans.experience,
            users.photo_profil,
            users.nom,
            users.prenom,
            users.email,
            users.role,
            services.nom
    `;

    const [resultats] = await db.promise().query(sql, [userId]);

    return resultats[0];
}

// modifier le profil d'un artisan
async function modifierProfilArtisan(userId, telephone, ville, description, experience) {
    const sql = `
        UPDATE artisans
        SET telephone = ?, ville = ?, description = ?, experience = ?
        WHERE user_id = ?
    `;

    const [resultat] = await db.promise().query(sql, [
        telephone,
        ville,
        description,
        experience,
        userId
    ]);

    return resultat;
}

module.exports = { // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    creerProfilArtisan,
    trouverTousLesArtisans,
    trouverArtisanParId,
    trouverArtisanParUserId,
    trouverProfilArtisanCompletParUserId,
    modifierProfilArtisan
};

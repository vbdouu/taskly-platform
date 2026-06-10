// Ce fichier contient les requêtes SQL liées à la table clients.
// Il sera utilisé pour créer un profil client et retrouver un client à partir de son compte utilisateur.

const db = require("../config/db");

// creer le profil d'un client
async function creerProfilClient(userId, telephone, ville, adresse) {
    const sql = `
        INSERT INTO clients (user_id, telephone, ville, adresse)
        VALUES (?, ?, ?, ?)
    `;

    const [resultat] = await db.promise().query(sql, [
        userId,
        telephone,
        ville,
        adresse
    ]);

    return resultat;
}

// recuperer un client a partir de son user_id
async function trouverClientParUserId(userId) {
    const sql = "SELECT * FROM clients WHERE user_id = ?";

    const [resultats] = await db.promise().query(sql, [userId]);

    return resultats[0];
}

// modifier le profil d'un client
async function modifierProfilClient(userId, telephone, ville, adresse) {
    const sql = `
        UPDATE clients
        SET telephone = ?, ville = ?, adresse = ?
        WHERE user_id = ?
    `;

    const [resultat] = await db.promise().query(sql, [
        telephone,
        ville,
        adresse,
        userId
    ]);

    return resultat;
}

module.exports = {
    creerProfilClient,
    trouverClientParUserId,
    modifierProfilClient
};

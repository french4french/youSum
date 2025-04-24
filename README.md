# YouSummarize - Résumé de vidéos YouTube avec IA

YouSummarize est une application web qui vous permet de générer automatiquement des résumés concis et structurés de n'importe quelle vidéo YouTube en utilisant l'intelligence artificielle.

## 🌟 Fonctionnalités

- Résumé automatique de vidéos YouTube à partir de leur URL
- Extraction des points clés et enseignements principaux
- Support multilingue (français et anglais)
- Génération de résumés détaillés avec l'API Gemini de Google
- Téléchargement des résumés en PDF
- Interface utilisateur intuitive et responsive

## 📋 Prérequis

Avant de lancer l'application, assurez-vous d'avoir :

- Node.js (v14 ou supérieur)
- npm (v6 ou supérieur)
- Un compte Google Cloud avec les APIs YouTube Data et Gemini activées
- Des clés API valides pour ces services

## ⚙️ Installation

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/votre-utilisateur/youSummarize.git
   cd youSummarize
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Configurez les variables d'environnement :
   - Copiez le fichier `.env.example` vers `.env`
   - Remplissez le fichier `.env` avec vos propres clés API

4. Lancez l'application :
   ```bash
   npm start
   ```

5. Ouvrez votre navigateur à l'adresse : `http://localhost:3000`

## 🔑 Configuration

Créez un fichier `.env` à la racine du projet avec les valeurs suivantes :

```
# Clé API YouTube Data (pour récupérer les informations et transcriptions des vidéos)
YOUTUBE_API_KEY=votre_clé_youtube_api

# Clé API Gemini (pour générer les résumés avec l'IA)
GEMINI_API_KEY=votre_clé_gemini_api

# URL de base pour le sitemap et autres liens absolus
BASE_URL=https://yoursitedomain.com

# Port du serveur (optionnel, par défaut 3000)
PORT=3000

## 🚀 Utilisation

1. Accédez à l'application dans votre navigateur
2. Collez l'URL d'une vidéo YouTube dans le champ prévu
3. Sélectionnez la langue souhaitée pour le résumé
4. Cliquez sur "Résumer la vidéo"
5. Patientez pendant que l'application :
   - Récupère les informations de la vidéo
   - Extrait la transcription
   - Génère un résumé avec l'IA
6. Consultez le résumé généré
7. Utilisez les boutons pour copier ou télécharger le résumé en PDF

## 🧩 Structure du projet

```
youSummarize/
├── public/                  # Frontend statique
│   ├── css/                 # Styles CSS
│   ├── js/                  # Scripts JavaScript frontend
│   └── index.html           # Page HTML principale
├── services/                # Services backend
│   └── transcript.js        # Service de récupération des transcriptions
├── .env                     # Variables d'environnement (non versionné)
├── .env.example             # Exemple de variables d'environnement
├── .gitignore               # Fichiers ignorés par Git
├── server.js                # Point d'entrée du serveur Express
├── package.json             # Dépendances et scripts npm
└── README.md                # Ce document
```

## 🛠️ Technologies utilisées

- **Backend**:
  - Node.js et Express pour le serveur API
  - Axios pour les requêtes HTTP
  - dotenv pour la gestion des variables d'environnement

- **Frontend**:
  - HTML5, CSS3 et JavaScript vanilla
  - Bibliothèques : FontAwesome (icônes), jsPDF (génération de PDF)

- **APIs**:
  - YouTube Data API v3 pour les informations et transcriptions des vidéos
  - Google Gemini API pour la génération de résumés avec IA

## 📝 Licence

Ce projet est distribué sous licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou proposer une pull request.

1. Forkez le projet
2. Créez votre branche de fonctionnalité (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add some amazing feature'`)
4. Poussez la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

## 🙏 Remerciements

- L'équipe de développement de YouTube pour leur API
- Google pour l'accès à l'API Gemini
- Tous les contributeurs et testeurs de cette application

---

Créé avec ❤️ par jp-fix

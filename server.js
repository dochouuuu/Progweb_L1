const fs = require("fs");
const http = require("http");
const { Client } = require('pg');
const crypto = require("crypto");

const host = 'localhost';
const port = 8089;
const server = http.createServer();

const client = new Client({
  user: 'postgres', 
  password : 'Joochou259', 
  database: 'application_image',
  port : 5432 
});

client.connect()
.then(() => {
  console.log('Connected to database');
})
.catch((e) => {
  console.log('Error connecting to database');
  console.log(e);
}); 

const imageComments = [];
let lastSessionId = 0;
let sessions = [];

server.on("request", async (req, res) => {
  let hasCookieWithSessionId = false;
  let sessionId = undefined;
  if (req.headers['cookie'] !== undefined) {
    let sessionIdInCookie = req.headers['cookie'].split(';').find(item => item.trim().startsWith('session-id'));
    if (sessionIdInCookie !== undefined) {
      let sessionIdInt = parseInt(sessionIdInCookie.split('=')[1]);
      if (sessions[sessionIdInt]) {
        hasCookieWithSessionId = true;
        sessionId = sessionIdInt;
        sessions[sessionId].nbRequest++;
      }
    }

  } if (!hasCookieWithSessionId) {
      lastSessionId++;
      res.setHeader('Set-Cookie', `session-id=${lastSessionId}`);
      sessionId = lastSessionId;
      sessions[lastSessionId] = {
          'nbRequest': 0
      }
  
  } if (req.method === 'GET' && req.url === '/signup') {
        res.end(generateSignFormPage(true));
  
  } else if (req.method === 'POST'&& req.url === '/signup') {
    let data;
    req.on("data", (dataChunk) => {
        data += dataChunk.toString();
    });
    req.on("end", async () => {
      try {
        const params = data.split("&");
        const username = params[0].split("=")[1];
        const password = params[1].split("=")[1];
        const findQuery = `SELECT count(username) FROM accounts WHERE username='${username}'`; 
        const findResult = await client.query(findQuery);
        const USERNAME_IS_UNKNOWN = 0;
        if (parseInt(findResult.rows[0].count) === USERNAME_IS_UNKNOWN) {
          const salt = crypto.randomBytes(16).toString('hex');
          const hash = crypto.createHash("sha256").update(password).update(salt).digest("hex");
          const insertQuery = `INSERT INTO accounts (username, salt, hash) VALUES ('${username}', decode('${salt}','hex') , decode('${hash}','hex'));`; 
          await client.query(insertQuery); 
          res.end(`<html><head><meta charset="UTF-8"></head><body><h1>Vous avez réussi à créer votre compte</h1><a href="/signin">Connectez-vous !</a></body></html>`);
        } else {
          res.end(`<html><head><meta charset="UTF-8"></head><body><h1>La création du compte a échoué</h1><div>L'identifiant a déjà existé !</div><a href="/signup">Réessayez !</a></body></html>`);
        }
      } catch(e) {
        console.log(e);
        res.end(`<html><body><h1>Failure</h1><a href="/">Réessayez !</a></body></html>`);
      }
    });

  } else if (req.method === 'GET' && req.url === '/signin') {
    res.end(generateSignFormPage(false));

  } else if (req.method === 'POST' && req.url === '/signin') {
    let data;
    req.on("data", (dataChunk) => {
        data += dataChunk.toString();
    });
    req.on("end", async () => {
        try {
          const params = data.split("&");
          const username = params[0].split("=")[1];
          const password = params[1].split("=")[1];
          const findQuery = `SELECT username, encode(salt,'hex') as salt, encode(hash,'hex') as hash FROM accounts WHERE username='${username}'`; 
          const findResult = await client.query(findQuery);
          const USERNAME_IS_UNKNOWN = 0;
          if (parseInt(findResult.rows.length) !== USERNAME_IS_UNKNOWN) {
            const salt = findResult.rows[0].salt;
            const trueHash = findResult.rows[0].hash;
            const computedHash = crypto.createHash("sha256").update(password).update(salt).digest("hex");
              if (trueHash === computedHash) { //AUTHENTICATED
                sessions[sessionId].username = username
                //console.log(username)
                res.statusCode = 302; 
                res.setHeader('Location', '/'); 
                res.end(); 
              } else {
                res.end(`<html><head><meta charset="UTF-8"></head>
                        <body><h1>Votre connection a échoué</h1> Mauvais mot de passe ! 
                        <a href="/signin">Retry</a></body></html>`);
              }
            } else {
              res.end(`<html><head><meta charset="UTF-8"></head>
                      <body><h1>Votre connection a échoué</h1> L'identifiant n'existe pas !
                      <a href="/signin">Retry</a></body></html>`);
            }
        } catch(e) {
            console.log(e);
            res.end(`<html><body>
                    <h1>Something goes wrong</h1> 
                    <a href="/">Retry</a></body></html>`);
        }
    });
  
  } else if (req.method === 'GET' && req.url === '/signout') {
    sessions[sessionId].username = undefined;
    res.statusCode = 302;
    res.setHeader('Location', '/');
    res.end();
  
  } else if (req.method === 'GET' && req.url.startsWith('/public/')) {
    try { 
        const fichier = fs.readFileSync('.'+req.url);
        res.end(fichier);
    } catch (err) {
        console.log(err);
        res.end("erreur ressource");
    } 

  } else if (req.url === '/images') {
    const sqlQuery = 'SELECT fichier FROM images LIMIT 53'; 
    const sqlResult = await client.query(sqlQuery);  
    const images = sqlResult.rows.map(row => row.fichier); 
    const insertQuery = 'SELECT image_id FROM accounts_images_likes JOIN images ON accounts_images_likes.image_id = images.id';
    const queryRespond = await client.query(insertQuery);  
    const likedImages = queryRespond.rows.map(row => row.image_id); 
    let html = `<!DOCTYPE html><html>
                <head><title>Mur d'images</title><meta charset="UTF-8">
                <link rel="stylesheet" href="/public/style.css"></head><body>`; 
    if (!sessions[sessionId].username){ 
      html += `<a href="/signup">S'incrire</a>
              <a href="/signin">Se connecter</a><br>`;
    } else { 
      html += `Bonjour ${sessions[sessionId].username},<br>
              <a href="/signout">Se déconnecter</a><br>`; 
    }
    html += `<a href="/index">Index</a>
            <div class="center"><h1>Mur images</h1></div><div id="mur">`;
    for (let i = 0; i < images.length; i++) {
      const sImage = images[i].split(".")[0] + "_small.jpg";
      const img = '<img src="/public/images/' + sImage + '" />';
      html += '<a href="/page-image/' + (i + 1) + '" >' + img + "</a>";
      if (sessions[sessionId].username){ 
        if(likedImages.includes(i+1)){ 
          html += '<p>liked</p>'
        } else { 
          html += '<a href="/like/' + (i + 1) + '"><p>like</p></a>'; 
        }
      }
    }
    html += "</div></body></html>"; 
    res.end(html);

  } else if (req.url.startsWith('/like/')) {
    const imageId = parseInt(req.url.split('/')[2]);
    const sqlQuery = `INSERT INTO accounts_images_likes (account_id, image_id) VALUES ('${sessionId}', ${imageId});`;
    await client.query(sqlQuery);
    res.statusCode = 302;
    res.setHeader('Location', '/images');
    res.end();

  } else if (req.url.startsWith('/page-image/')){
    let id = req.url.split('/')[2]; 
    let num = parseInt(id);  
    const sqlQuery = 'SELECT nom FROM images;'; 
    const sqlResult = await client.query(sqlQuery);  
    let pageHTML = `<!DOCTYPE html><html lang ="fr">
                    <head><meta charset="UTF-8"><link rel="stylesheet" href="/public/style.css">
                    <script type="text/javascript" src="/public/page-image.js" defer></script>
                    <body><a href="/index">Mur</a><div class="center"><img src="/public/images/image${num}.jpg" width="500">
                    <p>${sqlResult.rows[num - 1].nom}<p>`; 
    //console.log(sqlResult.rows[num - 1].nom); 

    const commentairesQuery = 'SELECT texte FROM commentaires WHERE commentaires.id_image = ' + num + '';
    const commentairesResult = await client.query(commentairesQuery);
    const commentaires = commentairesResult.rows.map(row => row.texte);
    imageComments[num] = commentaires; 
    //console.log(num, imageComments[num]); 
    
    if(imageComments[num] !== undefined){ 
      pageHTML += '<h4>Commentaires : </h4>';
      for(let i = 0; i < imageComments[num].length; i++){ 
        let comment = imageComments[num][i]; 
        pageHTML += `<div>${comment}</div>`;
      }
    }

    pageHTML += `<h4>Ajouter un nouveau commentaire</h4>'
                <form action="/image-description" method="post">
                <input type="hidden" name="imageId" value=${num}>
                <label for="commentaire">Commentaire : </label>
                <input type="text" name="commentaire" id="commentaire" value="">
                <input type="submit" value="Envoyer"></form></div>`;

    if(num == 1){ 
      pageHTML += '<div><span class="left"></span>';
    } else {
      pageHTML += `<div><span class="left"><a href="/page-image/${num-1}"><img src="/public/images/image${num-1}_small.jpg"></a></span>`;
    } 
    if(num >= 53){ 
      pageHTML += '<span class="right"></span></div>'; 
    } else { 
      pageHTML += `<span class="right"><a href="/page-image/${num+1}"><img src="/public/images/image${num+1}_small.jpg"></a></span></div>`;
    }
    pageHTML += "</body></html>"; 
    res.end(pageHTML);

  } else if (req.method === "POST" && req.url === "/image-description") {
    let donnees = '';
    req.on("data", (dataChunk) => {
        donnees += dataChunk.toString();
    });
    req.on("end", async () => { 
      const paramValeur = donnees.split("&");
      const imageId = parseInt(paramValeur[0].split("=")[1]);
      const commentaire = paramValeur[1].split("=")[1];
      try { 
        const sqlQuery = `INSERT INTO commentaires (texte, id_image) VALUES ('${commentaire}', ${imageId});`; 
        await client.query(sqlQuery); 
        console.log(commentaire);
        res.statusCode = 302;
        res.setHeader('Location', `/page-image/${imageId}`);
        res.end();
        } catch(e) { 
            console.log("Error executing query");
            console.log(e); 
        }
    });
    

  } else {
      const sqlQuery = 'SELECT fichier FROM images ORDER BY date DESC LIMIT 3'; 
      const sqlResult = await client.query(sqlQuery);  
      let pageINDEX = `<!DOCTYPE html><html>
                      <head><title>Mon mur dimages</title><meta charset="UTF-8"><link rel="stylesheet" href="/public/style.css"></head><body>`; 
      //console.log(sessions[sessionId].username); 
      if (!sessions[sessionId].username){ 
        pageINDEX += `<div classe="right"><a href="/signup">S'incrire</a>
                      <a href="/signin">Se connecter</a></div>`;
      } else { 
        pageINDEX += `<div class="left">Bonjour ${sessions[sessionId].username},<br>
                      <a href="/signout">Se déconnecter</a></div>`; 
      }           
      pageINDEX += `<div class="center"><img src="/public/logo.png" alt="logo">
                    <p>Vous trouvez ici toutes les images</p><div>`; 
      const images = sqlResult.rows.map(row => row.fichier); 
      for (let i = 0; i < images.length; i++) {
        const sImage = images[i].split('.')[0] + "_small.jpg";
        pageINDEX += '<img src="/public/images/' + sImage + '" />';
      }      
      pageINDEX += '</div><a href="/images">Toutes les images</a></body></html>'; 
      res.end(pageINDEX); 
  }
});

function generateSignFormPage(up) {
  let signWhat = up ? 'signup' : 'signin';
  return `<html><body><h1>${signWhat}</h1>
          <form action='/${signWhat}' method="POST">
            <label for="username">Identifiant: </label>
            <input type="text" name="username" id="username" required>
            <label for="username">Mot de passe: </label>
            <input type="password" name="password" id="password" required>
            <input type="submit" value="${signWhat}!">
          </form>
          </body></html>`;
}; 

server.listen(port, host, () => {                                                                                                                                                                                      
  console.log(`Server running at http://${host}:${port}/`);
});
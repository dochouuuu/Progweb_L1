const fs = require("fs");
const http = require("http");
const host = 'localhost';
const port = 8080;
const server = http.createServer();

const imageComments = {};

server.on("request", (req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/public/')) {
    try { 
        const fichier = fs.readFileSync('.'+req.url);
        res.end(fichier);
    } catch (err) {
        console.log(err);
        res.end("erreur ressource");
    } 

  } else if (req.url === '/images') {
    let sImages = fs.readdirSync("./public/images").filter(s => s.endsWith('_small.jpg'));
    let html = "<!DOCTYPE html><html>";
    html += '<head><title>Mur d\'images</title><link rel="stylesheet" href="/public/style.css"></head>';
    html += '<body><a href="/index" id="mur">Index</a><div class="center"><h1>Mur images</h1></div>';
    for (let i = 0; i < sImages.length; i++){
      let image = sImages[i]; 
      let number = image.replace('image',''); 
      let num = number.replace('_small.jpg', ''); 
      html += `<a href="/page-image/${num}"><img src="/public/images/${image}"></a>`;
    }
    html += "</body></html>"; 
    res.end(html);

  } else if (req.url.startsWith('/page-image/')){
    const images = fs.readdirSync('./public/images');
    let id = req.url.split('/')[2]; 
    let num = parseInt(id);  
    let pageHTML = "<!DOCTYPE html><html>";
    pageHTML += '<head><link rel="stylesheet" href="/public/style.css">';
    pageHTML += `<body><a href="/index">Mur</a><div class="center"><img src="/public/images/image${num}.jpg" width="500">`; 
    pageHTML += '<p>Magnifique Image</p>'; 
    if(imageComments[num] !== undefined){ 
      pageHTML += '<h4>Commentaires : </h4>';
      for(let i = 0; i < imageComments[num].length; i++){ 
        let comment = imageComments[num][i]; 
        pageHTML += `<div>${comment}</div>`;
      }
    }
    pageHTML += '<h4>Ajouter un nouveau commentaire</h4>';
    pageHTML += `<form action="/image-description" method="post"><input type="hidden" name="imageId" value=${num}><label for="commentaire">Commentaire : </label><input type="text" name="commentaire" id="commentaire"><input type="submit" value="Envoyer"></form></div>`;

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
    req.on("end", () => { 
        const paramValeur = donnees.split("&");
        const imageId = parseInt(paramValeur[0].split("=")[1]);
        const commentaire = paramValeur[1].split("=")[1];
        if (imageComments[imageId] === undefined) {
          imageComments[imageId] = [];
      }
      imageComments[imageId].push(commentaire);
        console.log(commentaire);
        res.statusCode = 302;
        res.setHeader('Location', `/page-image/${imageId}`);
        res.end();
    });
   } else {
    const index = fs.readFileSync("./index.html", "utf-8");
    res.end(index);
  }
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
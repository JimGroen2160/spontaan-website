const fs = require("fs");

const pagesDir = "./pages";
let urls = ["http://localhost:5500/"];

fs.readdirSync(pagesDir).forEach(file => {
  if (file.endsWith(".html")) {
    urls.push(`http://localhost:5500/pages/${file}`);
  }
});

console.log(JSON.stringify(urls));
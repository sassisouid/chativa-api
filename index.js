const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Chativa API is running 🚀");
});

// Exemple endpoint licence
app.post("/activate", (req, res) => {
  const { license_key } = req.body;
  res.json({ status: "active", key: license_key });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
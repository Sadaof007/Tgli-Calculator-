const axios = require("axios");

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { x, y } = req.query;

  if (!x || !y) {
    return res.status(400).json({
      success: false,
      message: "x (policy) and y (dob) query parameters are required."
    });
  }

  const targetUrl = `http://www.tgli.telangana.gov.in/Details.aspx?x=${x}&y=${y}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };

  try {
    const response = await axios.get(targetUrl, { headers, timeout: 12000 });
    const html = response.data;

    // Helper to extract values
    const getValueById = (id, htmlContent) => {
      let match = htmlContent.match(new RegExp(`value="([^"]*)"[^>]*id="${id}"`));
      if (match) return match[1].trim();
      match = htmlContent.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`));
      if (match) return match[1].trim();
      return "";
    };

    const name = getValueById("ContentPlaceHolder1_TextBox3", html);

    if (!name) {
      return res.status(200).json({
        success: false,
        message: "Policy details not found. Please verify policy number and date of birth."
      });
    }

    const fatherName = getValueById("ContentPlaceHolder1_TextBox4", html);
    const designation = getValueById("ContentPlaceHolder1_TextBox5", html);
    const dobValue = getValueById("ContentPlaceHolder1_TextBox6", html);
    const openingBalance = getValueById("ContentPlaceHolder1_TextBox8", html);
    const currentYearPremium = getValueById("ContentPlaceHolder1_TextBox9", html);
    const totalPremium = getValueById("ContentPlaceHolder1_TextBox10", html);

    const cleanNum = (str) => str ? parseInt(str.replace(/\D/g, "")) || 0 : 0;

    // Parse gridview
    const bonds = [];
    const tableMatch = html.match(/<table[^>]*id="ContentPlaceHolder1_GridView1"[^>]*>([\s\S]*?)<\/table>/);
    if (tableMatch) {
      const tableContent = tableMatch[1];
      const rows = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

      for (let i = 1; i < rows.length; i++) {
        const tds = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
        if (tds.length >= 6) {
          const values = tds.map(td => {
            const spanMatch = td.match(/<span[^>]*>([\s\S]*?)<\/span>/);
            return spanMatch ? spanMatch[1].trim() : "";
          });

          bonds.push({
            suffix: values[0],
            monthlyPremium: cleanNum(values[1]),
            sumAssured: cleanNum(values[2]),
            lastPremiumDue: values[3],
            commencement: values[4],
            maturity: values[5]
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      policyNo: x,
      name,
      fatherName,
      designation,
      dob: dobValue,
      openingBalance: cleanNum(openingBalance),
      currentYearPremium: cleanNum(currentYearPremium),
      totalPremium: cleanNum(totalPremium),
      bonds
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      message: "Failed to fetch details: " + error.message
    });
  }
};

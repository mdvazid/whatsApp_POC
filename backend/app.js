const { chromium } = require("playwright");
const path = require("path");
// const fs = require("fs-extra");
const fs = require("fs");
let app = require("express")();
const cors = require("cors");
app.use(cors());
const baseUrl = "https://web.whatsapp.com/";
const sendMessageUrl = "https://web.whatsapp.com/send/";
const port = 4000;

app.get("/api/initiateWhatsAppSession", async function (req, res) {
  let isQrGenerated = await initiateWhatsAppSession(req.query.rmn);
  console.log(isQrGenerated, "inside api");
  if (isQrGenerated == true) {
    res.status(400).json({ message: "Already logged in" });
  } else if (isQrGenerated == "qr generated") {
    res
      .status(200)
      .sendFile(
        path.join(
          __dirname,
          `./user_data/${req.query.rmn}/${req.query.rmn}.png`
        )
      );
  } else if (isQrGenerated == "sww") {
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/api/healthCheck", async function (req, res) {
  let isLoggedIn = await bridgeStatus(req.query.rmn, req.query.state);
  console.log(isLoggedIn, "inside api");
  if (isLoggedIn == true) {
    res.status(200).json({ message: "WhatsApp authentication connected" });
  } else if (isLoggedIn == false) {
    res.status(403).json({ message: "WhatsApp authentication disconnected" });
  } else if (isLoggedIn == "sww") {
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/api/sendMessage", async function (req, res) {
  let isMessageSent = await sendMessage(
    req.query.rmn,
    req.query.phone_number,
    req.query.message
  );
  console.log(isMessageSent, "inside api");
  if (isMessageSent == true) {
    res.status(200).json({ message: "WhatsApp message sent successfully" });
  } else if (isMessageSent == "sww") {
    res.status(500).json({ message: "Something went wrong." });
  } else if (isMessageSent == false) {
    res.status(403).json({ message: "WhatsApp authentication disconnected" });
  }
});

async function initiateWhatsAppSession(rmn) {
  const userDataDir = `./user_data/${rmn}`;
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
  });
  try {
    const page = await browserContext.newPage();
    await page.goto(baseUrl);

    try {
      let isChatVisible = await page.waitForSelector(
        'xpath=//header[@data-testid="chatlist-header"]',
        { timeout: 10000 }
      );
      console.log(isChatVisible);

      if (isChatVisible) {
        await browserContext.close();
        return true;
      }
    } catch (err) {
      let isQrGenerated = await getWhatsAppQR(page, rmn);
      setTimeout(async () => {
        await browserContext.close();
      }, 20000);
      return isQrGenerated;
    }
  } catch (error) {
    console.log(new Error(error));
    await browserContext.close();
    return "sww";
  }
}

async function getWhatsAppQR(page, rmn) {
  console.log("screenshot starting");
  await page
    .locator('//div[@data-testid="qrcode"]')
    .screenshot({ path: `./user_data/${rmn}/${rmn}.png` });
  console.log("screenshot done");
  return "qr generated";
}

async function bridgeStatus(rmn, state) {
  try {
    const userDataDir = `./user_data/${rmn}`;
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
    });
    try {
      const page = await browserContext.newPage();
      await page.goto(baseUrl);

      try {
        let isChatVisible = await page.waitForSelector(
          'xpath=//header[@data-testid="chatlist-header"]',
          { timeout: 10000 }
        );
        console.log(isChatVisible);

        if (isChatVisible) {
          await browserContext.close();
          return true;
        }
      } catch (err) {
        const isLoggedIn = await page.$('//div[@data-testid="qrcode"]');
        if (isLoggedIn) {
          console.log(new Error(err));
          await browserContext.close();
          if (state == "new") {
            await browserContext.close();
            return false;
          } else {
            await browserContext.close();
            fs.rmSync(`./user_data/${rmn}`, { recursive: true, force: true });
            return false;
          }
        }
      }
    } catch (error) {
      await browserContext.close();
      if (state == "new") {
        await browserContext.close();
        console.log(new Error(error));
        return false;
      } else {
        await browserContext.close();
        console.log(new Error(error));
        return "sww";
      }
    }
  } catch (error_onspawn) {
    if (state == "new") {
      console.log(new Error(error_onspawn));
      return false;
    } else {
      console.log(new Error(error_onspawn));
      return "sww";
    }
  }
}

async function sendMessage(rmn, phone_number, message) {
  const userDataDir = `./user_data/${rmn}`;
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
  });
  try {
    const page = await browserContext.newPage();
    await page.goto(baseUrl);

    try {
      let isChatVisible = await page.waitForSelector(
        'xpath=//header[@data-testid="chatlist-header"]',
        { timeout: 20000 }
      );
      console.log(isChatVisible);

      if (isChatVisible) {
        await page.goto(
          `${sendMessageUrl}?phone=+91${phone_number}&text=${message}`
        );
        await page.waitForSelector(
          'xpath=//header[@data-testid="conversation-header"]',
          { timeout: 60000 }
        );
        await page.click('//span[@data-testid="send"]');
        setTimeout(async () => {
          await browserContext.close();
        }, 2000);
        return true;
      }
    } catch (err) {
      console.log(new Error(err));
      const isLoggedIn = await page.$('//div[@data-testid="qrcode"]');
      if (isLoggedIn) {
        await browserContext.close();
        fs.rmSync(`./user_data/${rmn}`, { recursive: true, force: true });
        return false;
      }
    }
  } catch (error) {
    await browserContext.close();
    console.log(new Error(error));
    return "sww";
  }
}

app.listen(port, function () {
  console.log("Server started");
});
